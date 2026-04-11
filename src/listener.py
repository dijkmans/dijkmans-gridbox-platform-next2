import json
import os
import platform
import re
import shlex
import subprocess
import threading
import time
from datetime import datetime
from io import BytesIO
from zoneinfo import ZoneInfo

import requests
from requests.auth import HTTPBasicAuth
from google.cloud import storage
from google.cloud.firestore import GeoPoint
from google.cloud.firestore_v1.base_query import FieldFilter
from google.oauth2 import service_account
from PIL import Image, ImageChops, ImageStat

from db_manager import get_db

# =========================================================
# GRIDBOX SERVICE - MASTER v1.0.51
# ÃƒÆ’Ã¢â‚¬Â°ÃƒÆ’Ã‚Â©n script:
# - bootstrap bij opstart
# - runtime voor commands / knop / camera / heartbeat
# - GEEN auto-update
# - WEL update / downgrade via Firestore:
#     software.targetVersion
#     software.softwareUpdateRequested = true
#
# LOKALE UITBREIDINGEN:
# - snapshots krijgen metadata-index in Firestore
# - eenvoudige change-detectie op beeldverschil
# =========================================================

VERSION = "v1.0.51"
KEY_PATH = "service-account.json"
BOOTSTRAP_PATH = "box_bootstrap.json"
RUNTIME_CONFIG_PATH = "runtime_config.json"
BUCKET_NAME = "gridbox-platform.firebasestorage.app"
TIMEZONE = ZoneInfo("Europe/Brussels")

HEARTBEAT_INTERVAL_SECONDS = 300
SOFTWARE_POLL_INTERVAL_SECONDS = 15
GITHUB_TAG_CACHE_TTL_SECONDS = 900

# I2C & GPIO Config
I2C_BUS = 1
I2C_ADDRESS = "0x10"
SHUTTER_OPEN_RELAY_ID = "0x01"   # Relais 1: Motor omhoog
SHUTTER_CLOSE_RELAY_ID = "0x02"  # Relais 2: Motor omlaag
LIGHT_RELAY_ID = "0x03"          # Relais 3: verlichting
CLOSE_BUTTON_PIN = 8             # GPIO 8 (Pin 24)

cached_config = {}
box_is_open = False
snapshot_thread_running = False
last_snapshot_small = None
last_snapshot_id = None
current_session_id = None
session_started_at = None
last_saved_snapshot_at = None

state_lock = threading.Lock()
command_lock = threading.Lock()
software_update_lock = threading.Lock()
snapshot_lock = threading.Lock()

light_off_timer = None
shutter_motor_timer = None

github_tag_cache = {
    "value": "unknown",
    "fetched_at": 0
}

software_action_in_progress = False

GPIO_AVAILABLE = False
BUTTON_FACTORY = None

if platform.system() != "Windows":
    try:
        from gpiozero import Button
        GPIO_AVAILABLE = True
        try:
            from gpiozero.pins.lgpio import LGPIOFactory
            BUTTON_FACTORY = LGPIOFactory()
        except Exception:
            BUTTON_FACTORY = None
    except Exception:
        GPIO_AVAILABLE = False

try:
    RESAMPLE_LANCZOS = Image.Resampling.LANCZOS
except AttributeError:
    RESAMPLE_LANCZOS = Image.LANCZOS


# =========================================================
# LOGGING
# =========================================================

def log(message):
    print(f"[{datetime.now(TIMEZONE).strftime('%Y-%m-%d %H:%M:%S')}] {message}")


# =========================================================
# HARDWARE LAYER
# =========================================================

class I2CRelay:
    def __init__(self, bus, address, relay_id, name):
        self.bus = str(bus)
        self.address = str(address)
        self.relay_id = str(relay_id)
        self.name = name

    def _run(self, value, action_text):
        if platform.system() == "Windows":
            return

        cmd = ["sudo", "-n", "i2cset", "-y", self.bus, self.address, self.relay_id, value]
        try:
            subprocess.run(cmd, check=True, capture_output=True)
            log(f"[I2C] {self.name} -> {action_text}")
        except Exception as e:
            log(f"[FOUT] Hardware weigert: {self.name} | {e}")

    def on(self):
        self._run("0xFF", "AAN")

    def off(self):
        self._run("0x00", "UIT")


# =========================================================
# BASIS HELPERS
# =========================================================

def now_dt():
    return datetime.now(TIMEZONE)

def now_iso():
    return now_dt().isoformat()

def safe_doc_id(value):
    value = str(value).strip().lower()
    value = re.sub(r"[^a-z0-9._-]+", "_", value)
    value = re.sub(r"_+", "_", value).strip("_")
    return value or "unknown"

def cancel_timer(timer_obj):
    if timer_obj:
        try:
            timer_obj.cancel()
        except Exception:
            pass

def start_daemon_timer(seconds, callback):
    t = threading.Timer(float(seconds), callback)
    t.daemon = True
    t.start()
    return t

def read_pi_model():
    if platform.system() == "Windows":
        return "Windows-Simulatie"

    model_paths = ["/proc/device-tree/model", "/sys/firmware/devicetree/base/model"]
    for path in model_paths:
        try:
            with open(path, "rb") as f:
                return f.read().replace(b"\x00", b"").decode("utf-8").strip()
        except Exception:
            pass

    return platform.platform()

def load_box_config():
    try:
        with open("box_config.json", "r", encoding="utf-8") as f:
            data = json.load(f)
        return data, data.get("deviceId")
    except Exception as e:
        raise RuntimeError(f"Config fout: {e}")


def load_bootstrap_config():
    if not os.path.exists(BOOTSTRAP_PATH):
        return None

    try:
        with open(BOOTSTRAP_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        log(f"âš ï¸ Bootstrapbestand kon niet gelezen worden: {e}")
        return None

def save_runtime_config(runtime_config):
    try:
        with open(RUNTIME_CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(runtime_config, f, indent=2, ensure_ascii=False)
        log(f"ðŸ’¾ Runtimeconfig opgeslagen in {RUNTIME_CONFIG_PATH}")
    except Exception as e:
        log(f"âš ï¸ Runtimeconfig kon niet opgeslagen worden: {e}")

def load_runtime_config():
    if not os.path.exists(RUNTIME_CONFIG_PATH):
        return None

    try:
        with open(RUNTIME_CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        log(f"⚠️ Runtimeconfig kon niet gelezen worden: {e}")
        return None
def try_backend_bootstrap_claim():
    bootstrap = load_bootstrap_config()
    if not isinstance(bootstrap, dict):
        return False

    api_base_url = str(bootstrap.get("apiBaseUrl") or "").strip().rstrip("/")
    provisioning_id = str(bootstrap.get("provisioningId") or "").strip()
    bootstrap_token = str(bootstrap.get("bootstrapToken") or "").strip()
    bootstrap_box_id = str(bootstrap.get("boxId") or DOCUMENT_ID or "").strip()

    if not api_base_url or not provisioning_id or not bootstrap_token or not bootstrap_box_id:
        log("âš ï¸ Bootstrapbestand mist verplichte velden voor backend-claim")
        return False

    claim_url = f"{api_base_url}/device/bootstrap/claim"
    payload = {
        "provisioningId": provisioning_id,
        "boxId": bootstrap_box_id,
        "bootstrapToken": bootstrap_token,
        "deviceName": DOCUMENT_ID
    }

    try:
        response = requests.post(claim_url, json=payload, timeout=20)
        if response.status_code != 200:
            log(f"âš ï¸ Backend bootstrap-claim geweigerd: {response.status_code} | {response.text}")
            if 400 <= response.status_code < 500:
                return None  # permanente afwijzing - niet opnieuw proberen
            return False  # tijdelijk (5xx, netwerk) - mag opnieuw proberen

        body = response.json() if response.content else {}
        item = body.get("item", {}) if isinstance(body, dict) else {}
        runtime_config = item.get("runtimeConfig") if isinstance(item, dict) else None

        if not isinstance(runtime_config, dict) or not runtime_config:
            log("âš ï¸ Backend bootstrap-claim gaf geen bruikbare runtimeConfig terug")
            return False

        runtime_config["provisioningId"] = provisioning_id
        runtime_config["claimedAt"] = item.get("claimedAt")
        runtime_config["status"] = item.get("status")

        save_runtime_config(runtime_config)
        log(f"âœ… Backend bootstrap-claim geslaagd voor {bootstrap_box_id}")

        try:
            os.remove(BOOTSTRAP_PATH)
            log(f"🗑️ box_bootstrap.json verwijderd na geslaagde claim")
        except Exception as remove_error:
            log(f"⚠️ Kon box_bootstrap.json niet verwijderen: {remove_error}")

        return True

    except Exception as e:
        log(f"âš ï¸ Backend bootstrap-claim fout: {e}")
        return False
def deep_merge_missing(existing, defaults):
    if isinstance(existing, dict) and isinstance(defaults, dict):
        result = dict(existing)
        for key, default_value in defaults.items():
            if key not in result:
                result[key] = default_value
            else:
                result[key] = deep_merge_missing(result[key], default_value)
        return result
    return existing

def refresh_cached_config():
    global cached_config
    try:
        doc = box_doc_ref.get()
        cached_config = doc.to_dict() if doc.exists else {}
    except Exception as e:
        log(f"ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â cached_config kon niet vernieuwd worden: {e}")

def build_location_payload(location_cfg):
    payload = {
        "street": location_cfg.get("street"),
        "number": location_cfg.get("number"),
        "postalCode": location_cfg.get("postalCode"),
        "city": location_cfg.get("city"),
        "country": location_cfg.get("country", "BE")
    }

    lat = location_cfg.get("lat")
    lng = location_cfg.get("lng")
    if lat is not None and lng is not None:
        payload["geo"] = GeoPoint(float(lat), float(lng))

    return {k: v for k, v in payload.items() if v is not None}


# =========================================================
# GIT / RELEASE HELPERS
# =========================================================

def get_repo_root():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    try:
        root = subprocess.check_output(
            ["git", "-C", script_dir, "rev-parse", "--show-toplevel"],
            stderr=subprocess.STDOUT
        ).decode().strip()
        return root
    except Exception:
        return script_dir

def run_cmd(cmd, cwd=None, timeout=None):
    return subprocess.run(
        cmd,
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=timeout
    )

def run_cmd_checked(cmd, cwd=None, timeout=None):
    result = run_cmd(cmd, cwd=cwd, timeout=timeout)
    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        stdout = (result.stdout or "").strip()
        raise RuntimeError(stderr or stdout or f"Commando faalde: {' '.join(cmd)}")
    return result

def get_github_tag_pattern():
    sw_cfg = box_config.get("software", {})
    return sw_cfg.get("githubTagPattern", "v*")

def get_latest_github_tag(force=False):
    global github_tag_cache

    now_ts = time.time()
    if not force and (now_ts - github_tag_cache["fetched_at"] < GITHUB_TAG_CACHE_TTL_SECONDS):
        return github_tag_cache["value"]

    pattern = get_github_tag_pattern()

    try:
        run_cmd_checked(["git", "fetch", "--tags", "origin"], cwd=REPO_ROOT, timeout=20)

        tags_raw = subprocess.check_output(
            ["git", "-C", REPO_ROOT, "tag", "--list", pattern, "--sort=-version:refname"],
            stderr=subprocess.STDOUT
        ).decode().splitlines()

        latest = tags_raw[0].strip() if tags_raw else "unknown"
        github_tag_cache = {
            "value": latest,
            "fetched_at": now_ts
        }
        return latest

    except Exception as e:
        log(f"ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â GitHub tag uitlezen mislukt: {e}")
        github_tag_cache = {
            "value": "error",
            "fetched_at": now_ts
        }
        return "error"

def get_repo_commit():
    try:
        return subprocess.check_output(
            ["git", "-C", REPO_ROOT, "rev-parse", "--short", "HEAD"],
            stderr=subprocess.STDOUT
        ).decode().strip()
    except Exception:
        return "unknown"

def ensure_target_tag_exists(tag_name):
    # Probeer tags te fetchen, maar gooi geen exception als dit mislukt.
    # Als de tag lokaal al bestaat (vorige fetch), kan de update toch doorgaan.
    try:
        run_cmd_checked(["git", "fetch", "--tags", "origin"], cwd=REPO_ROOT, timeout=20)
    except Exception as e:
        log(f"WARN: git fetch --tags mislukt ({e}) — controleer of tag {tag_name} lokaal beschikbaar is")

    result = run_cmd(
        ["git", "rev-parse", "-q", "--verify", f"refs/tags/{tag_name}"],
        cwd=REPO_ROOT
    )
    if result.returncode != 0:
        log(f"WARN: ensure_target_tag_exists: tag '{tag_name}' niet gevonden (lokaal noch remote)")
    return result.returncode == 0

def ensure_repo_clean_for_checkout():
    result = run_cmd(
        ["git", "status", "--porcelain", "--untracked-files=no"],
        cwd=REPO_ROOT
    )
    if result.returncode != 0:
        raise RuntimeError("Kon git status niet uitlezen.")

    dirty_lines = [line.strip() for line in (result.stdout or "").splitlines() if line.strip()]
    if dirty_lines:
        preview = "; ".join(dirty_lines[:5])
        raise RuntimeError(
            "Repo bevat lokale wijzigingen. Checkout naar andere tag is niet veilig. "
            f"Eerste regels: {preview}"
        )

def checkout_target_version(tag_name):
    run_cmd_checked(["git", "checkout", "--detach", tag_name], cwd=REPO_ROOT, timeout=30)

def maybe_install_requirements():
    sw_cfg = box_config.get("software", {})
    if sw_cfg.get("pipInstallOnDeploy", True) is not True:
        return

    requirements_path = os.path.join(REPO_ROOT, "requirements.txt")
    if not os.path.exists(requirements_path):
        return

    python_exec = sw_cfg.get("pythonExecutable", "python3")
    run_cmd_checked(
        [python_exec, "-m", "pip", "install", "--break-system-packages", "-r", requirements_path],
        cwd=REPO_ROOT,
        timeout=600
    )

def schedule_service_restart():
    sw_cfg = box_config.get("software", {})
    service_name = sw_cfg.get("serviceName", "gridbox-listener.service")
    restart_delay = float(sw_cfg.get("restartDelaySeconds", 2))

    command = f"sleep {restart_delay}; sudo -n systemctl restart {shlex.quote(service_name)}"
    subprocess.Popen(
        ["bash", "-lc", command],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True
    )


# =========================================================
# SOFTWARE STATUS HELPERS
# =========================================================

def get_running_version():
    return VERSION

def get_running_commit():
    return STARTUP_GIT_COMMIT

def derive_deployment_status(version_raspberry, target_version):
    if not version_raspberry or not target_version:
        return "UNKNOWN"
    if version_raspberry == target_version:
        return "ON_TARGET"
    return "MISMATCH"

def derive_update_status(existing_update_status, deployment_status):
    if deployment_status == "ON_TARGET":
        return "ON_TARGET"

    if existing_update_status == "FAILED":
        return "FAILED"

    if deployment_status == "MISMATCH":
        return "MISMATCH"

    return "UNKNOWN"

def write_software_fields(fields):
    box_doc_ref.set({
        "software": fields,
        "updatedAt": now_iso(),
        "updatedBy": f"gridbox-service-{VERSION}"
    }, merge=True)

def mark_update_failed(message, target_version=None):
    global software_action_in_progress
    software_action_in_progress = False

    version_raspberry = get_running_version()
    deployment_status = derive_deployment_status(version_raspberry, target_version)

    write_software_fields({
        "softwareUpdateRequested": False,
        "updateStatus": "FAILED",
        "deploymentStatus": deployment_status,
        "lastError": message,
        "lastUpdateAttemptAt": now_iso()
    })
    log(f"ÃƒÂ¢Ã‚ÂÃ…â€™ Software update mislukt: {message}")


# =========================================================
# BOOTSTRAP HELPERS
# =========================================================

def has_customer_config():
    customer = box_config.get("customer", {})
    return bool(customer.get("id") and customer.get("name"))

def has_site_config():
    site = box_config.get("site", {})
    return bool(site.get("id") and site.get("name"))

def build_hardware_defaults_from_box_config():
    hw_cfg = box_config.get("hardware", {})
    camera_cfg = hw_cfg.get("camera", {})

    hardware_defaults = {
        "shutter": {
            "openDurationSeconds": hw_cfg.get("shutter", {}).get("openDurationSeconds", 30),
            "closeDurationSeconds": hw_cfg.get("shutter", {}).get("closeDurationSeconds", 30)
        },
        "lighting": {
            "lightOffDelaySeconds": hw_cfg.get("lighting", {}).get("lightOffDelaySeconds", 60),
            "onWhenOpen": hw_cfg.get("lighting", {}).get("onWhenOpen", True)
        },
        "camera": {
            "enabled": camera_cfg.get("enabled", True),
            "snapshotIntervalSeconds": camera_cfg.get("snapshotIntervalSeconds", 5),
            "postCloseSnapshotDurationSeconds": camera_cfg.get("postCloseSnapshotDurationSeconds", 30),
            "changeDetectionThreshold": camera_cfg.get("changeDetectionThreshold", 6.0)
        }
    }

    if "snapshotUrl" in camera_cfg:
        hardware_defaults["camera"]["snapshotUrl"] = camera_cfg["snapshotUrl"]
    if "username" in camera_cfg:
        hardware_defaults["camera"]["username"] = camera_cfg["username"]
    if "password" in camera_cfg:
        hardware_defaults["camera"]["password"] = camera_cfg["password"]

    return hardware_defaults

def build_software_defaults_from_box_config():
    sw_cfg = box_config.get("software", {})
    return {
        "targetVersion": sw_cfg.get("targetVersion", VERSION),
        "deploymentMode": sw_cfg.get("deploymentMode", "firestore"),
        "githubTagPattern": sw_cfg.get("githubTagPattern", "v*"),
        "softwareUpdateRequested": sw_cfg.get("softwareUpdateRequested", False),
        "updateStatus": "UNKNOWN",
        "deploymentStatus": "UNKNOWN",
        "lastError": None,
        "serviceName": sw_cfg.get("serviceName", "gridbox-listener.service"),
        "pipInstallOnDeploy": sw_cfg.get("pipInstallOnDeploy", True),
        "restartDelaySeconds": sw_cfg.get("restartDelaySeconds", 2)
    }

def ensure_customer_exists():
    if not has_customer_config():
        return None

    customer_cfg = box_config.get("customer", {})
    customer_id = safe_doc_id(customer_cfg["id"])
    ref = db.collection("customers").document(customer_id)
    snap = ref.get()

    payload = {
        "customerId": customer_id,
        "name": customer_cfg["name"],
        "active": customer_cfg.get("active", True),
        "updatedAt": now_iso(),
        "updatedBy": f"gridbox-service-{VERSION}"
    }

    if not snap.exists:
        payload["createdAt"] = now_iso()
        payload["createdBy"] = f"gridbox-service-{VERSION}"

    ref.set(payload, merge=True)
    log(f"ÃƒÂ°Ã…Â¸Ã‚ÂÃ‚Â¢ Customer verzekerd: customers/{customer_id}")
    return customer_id

def ensure_site_exists(customer_id):
    if not has_site_config():
        return None

    site_cfg = box_config.get("site", {})
    site_id = safe_doc_id(site_cfg["id"])
    ref = db.collection("sites").document(site_id)
    snap = ref.get()

    payload = {
        "siteId": site_id,
        "customerId": customer_id,
        "name": site_cfg["name"],
        "active": site_cfg.get("active", True),
        "updatedAt": now_iso(),
        "updatedBy": f"gridbox-service-{VERSION}"
    }

    if "code" in site_cfg:
        payload["code"] = site_cfg["code"]

    if isinstance(site_cfg.get("location"), dict):
        payload["location"] = build_location_payload(site_cfg["location"])

    if not snap.exists:
        payload["createdAt"] = now_iso()
        payload["createdBy"] = f"gridbox-service-{VERSION}"

    ref.set(payload, merge=True)
    log(f"ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â Site verzekerd: sites/{site_id}")
    return site_id

def ensure_bootstrap_admin_user():
    admin_user = box_config.get("bootstrapAdminUser")
    if not isinstance(admin_user, dict):
        return

    user_id = safe_doc_id(
        admin_user.get("id")
        or admin_user.get("email")
        or admin_user.get("phoneNumber")
        or "bootstrap_admin"
    )

    ref = box_doc_ref.collection("authorizedUsers").document(user_id)
    snap = ref.get()

    payload = {
        "email": admin_user.get("email"),
        "name": admin_user.get("name"),
        "phoneNumber": admin_user.get("phoneNumber"),
        "role": admin_user.get("role", "admin"),
        "active": admin_user.get("active", True),
        "updatedAt": now_iso(),
        "updatedBy": f"gridbox-service-{VERSION}"
    }

    payload = {k: v for k, v in payload.items() if v is not None}

    if not snap.exists:
        payload["createdAt"] = now_iso()
        payload["createdBy"] = f"gridbox-service-{VERSION}"

    ref.set(payload, merge=True)
    log(f"ÃƒÂ°Ã…Â¸Ã¢â‚¬ËœÃ‚Â¤ Bootstrap admin verzekerd: boxes/{DOCUMENT_ID}/authorizedUsers/{user_id}")

def ensure_legacy_mirror_if_enabled(customer_id, site_id):
    compatibility_cfg = box_config.get("compatibility", {})
    if not compatibility_cfg.get("mirrorCustomerAndSiteUnderBox", False):
        return

    if customer_id and has_customer_config():
        customer_cfg = box_config.get("customer", {})
        box_doc_ref.collection("customers").document(customer_id).set({
            "customerId": customer_id,
            "name": customer_cfg["name"],
            "active": customer_cfg.get("active", True),
            "mirroredAt": now_iso(),
            "mirroredBy": f"gridbox-service-{VERSION}"
        }, merge=True)
        log(f"ÃƒÂ°Ã…Â¸Ã‚ÂªÃ…Â¾ Legacy customer mirror gezet onder box: {customer_id}")

    if site_id and has_site_config():
        site_cfg = box_config.get("site", {})
        site_payload = {
            "siteId": site_id,
            "customerId": customer_id,
            "name": site_cfg["name"],
            "active": site_cfg.get("active", True),
            "mirroredAt": now_iso(),
            "mirroredBy": f"gridbox-service-{VERSION}"
        }
        if isinstance(site_cfg.get("location"), dict):
            site_payload["location"] = build_location_payload(site_cfg["location"])

        box_doc_ref.collection("sites").document(site_id).set(site_payload, merge=True)
        log(f"ÃƒÂ°Ã…Â¸Ã‚ÂªÃ…Â¾ Legacy site mirror gezet onder box: {site_id}")

def bootstrap_if_needed():
    if isinstance(runtime_config, dict) and runtime_config:
        log("INFO: new bootstrap flow active, skipping legacy Firestore bootstrap")
        refresh_cached_config()
        load_box_state_from_firestore()
        return
    customer_id = ensure_customer_exists()
    site_id = ensure_site_exists(customer_id) if has_site_config() else None

    existing_doc = box_doc_ref.get()
    existing_data = existing_doc.to_dict() if existing_doc.exists else {}

    hardware_defaults = build_hardware_defaults_from_box_config()
    software_defaults = build_software_defaults_from_box_config()

    bootstrap_defaults = {
        "boxId": DOCUMENT_ID,
        "status": existing_data.get("status", "offline"),
        "hardware": hardware_defaults,
        "software": software_defaults,
        "state": {
            "boxIsOpen": existing_data.get("state", {}).get("boxIsOpen", False)
        },
        "provisioning": {
            "initialized": True,
            "initializedAt": existing_data.get("provisioning", {}).get("initializedAt", now_iso()),
            "initializedBy": existing_data.get("provisioning", {}).get("initializedBy", f"gridbox-service-{VERSION}")
        }
    }

    final_payload = deep_merge_missing(existing_data, bootstrap_defaults)

    if customer_id:
        final_payload["customerId"] = customer_id

    if site_id:
        final_payload["siteId"] = site_id

    if box_config.get("boxName"):
        final_payload["name"] = box_config.get("boxName")

    if box_config.get("boxNumber"):
        final_payload["boxNumber"] = box_config.get("boxNumber")

    if box_config.get("notes"):
        final_payload["notes"] = box_config.get("notes")

    if isinstance(box_config.get("metadata"), dict):
        final_payload["metadata"] = box_config.get("metadata")

    final_payload["provisioning"]["initialized"] = True
    final_payload["provisioning"]["lastProvisionedAt"] = now_iso()
    final_payload["provisioning"]["lastProvisionedBy"] = f"gridbox-service-{VERSION}"
    final_payload["provisioning"]["scriptVersion"] = VERSION

    if not existing_doc.exists:
        final_payload["createdAt"] = now_iso()
        final_payload["createdBy"] = f"gridbox-service-{VERSION}"

    final_payload["updatedAt"] = now_iso()
    final_payload["updatedBy"] = f"gridbox-service-{VERSION}"

    box_doc_ref.set(final_payload, merge=True)
    log(f"ÃƒÂ°Ã…Â¸Ã‚Â§Ã‚Â± Bootstrap gecontroleerd voor boxes/{DOCUMENT_ID}")

    ensure_bootstrap_admin_user()
    ensure_legacy_mirror_if_enabled(customer_id, site_id)

    refresh_cached_config()
    load_box_state_from_firestore()


# =========================================================
# STATE
# =========================================================

def update_box_state(is_open, action_source):
    global box_is_open

    with state_lock:
        box_is_open = bool(is_open)

    try:
        box_doc_ref.set({
            "state": {
                "boxIsOpen": bool(is_open),
                "lastActionAt": now_iso(),
                "lastActionSource": action_source
            }
        }, merge=True)
    except Exception as e:
        log(f"ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Kon state niet opslaan: {e}")

def load_box_state_from_firestore():
    global box_is_open
    try:
        doc = box_doc_ref.get()
        data = doc.to_dict() if doc.exists else {}
        with state_lock:
            box_is_open = bool(data.get("state", {}).get("boxIsOpen", False))
        log(f"ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¦ Herstelde box_is_open = {box_is_open}")
    except Exception as e:
        log(f"ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Kon box state niet laden: {e}")


# =========================================================
# HEARTBEAT + SOFTWARE STATUS
# =========================================================

def get_gateway_ip():
    """Geeft het IPv4-adres van de default gateway terug, of None."""
    if platform.system() == "Windows":
        return None
    try:
        result = subprocess.run(
            ["ip", "route", "show", "default"],
            capture_output=True, text=True, timeout=5
        )
        # Zoek specifiek naar een IPv4-adres na 'default via'
        match = re.search(r"default via (\d+\.\d+\.\d+\.\d+)", result.stdout)
        if match:
            return match.group(1)
        log(f"WARN: get_gateway_ip: geen IPv4 gateway gevonden in: {result.stdout.strip()!r}")
        return None
    except Exception as e:
        log(f"WARN: get_gateway_ip: fout: {e}")
        return None


def ping_gateway(gateway_ip: str) -> bool:
    """Ping de gateway 1x om de ARP-cache te vullen. Geeft True terug als bereikbaar."""
    try:
        result = subprocess.run(
            ["ping", "-c", "1", "-W", "2", gateway_ip],
            capture_output=True, timeout=6
        )
        return result.returncode == 0
    except Exception:
        return False


def get_mac_from_proc_arp(gateway_ip: str) -> str | None:
    """Leest het MAC-adres van een IP uit /proc/net/arp (meest betrouwbaar op Linux)."""
    try:
        with open("/proc/net/arp", "r") as f:
            for line in f:
                parts = line.split()
                # Formaat: IP HW_type Flags HW_addr Mask Device
                if len(parts) >= 4 and parts[0] == gateway_ip:
                    mac = parts[3]
                    if re.match(r"^[0-9a-f]{2}(:[0-9a-f]{2}){5}$", mac, re.IGNORECASE):
                        return mac.lower()
    except Exception:
        pass
    return None


def get_gateway_mac():
    """Detecteert het MAC-adres van de default gateway via 'ip route' en 'arp'."""
    gateway_ip = get_gateway_ip()
    if not gateway_ip:
        return None
    try:
        arp_result = subprocess.run(
            ["arp", "-n", gateway_ip],
            capture_output=True, text=True, timeout=5
        )
        mac_match = re.search(r"([0-9a-f]{2}(?::[0-9a-f]{2}){5})", arp_result.stdout, re.IGNORECASE)
        if not mac_match:
            return None
        return mac_match.group(1).lower()
    except Exception as e:
        log(f"WARN: get_gateway_mac fout: {e}")
        return None


def get_gateway_serial():
    """Vraagt het serienummer op van de lokale Teltonika-router via GET /api/v1/system/board.
    Geeft None terug als de router niet bereikbaar is of geen serienummer retourneert.
    Logt elk faalpad zodat problemen zichtbaar zijn in de service-output.
    """
    gateway_ip = get_gateway_ip()
    if not gateway_ip:
        log("WARN: get_gateway_serial: gateway IP niet detecteerbaar via 'ip route'")
        return None
    try:
        resp = requests.get(
            f"http://{gateway_ip}/api/v1/system/board",
            timeout=3
        )
        if not resp.ok:
            log(f"WARN: get_gateway_serial: router API op {gateway_ip} antwoordde HTTP {resp.status_code}")
            return None
        data = resp.json()
        board = data.get("board", {})
        serial = board.get("serial") or board.get("sn") or board.get("serial_number")
        if serial and isinstance(serial, str):
            log(f"INFO: get_gateway_serial: serienummer gevonden: {serial.strip()}")
            return serial.strip()
        log(f"WARN: get_gateway_serial: geen serial-veld in router response. Beschikbare velden: {list(board.keys())}")
        return None
    except requests.exceptions.ConnectionError as e:
        log(f"WARN: get_gateway_serial: router API niet bereikbaar op {gateway_ip} — {e}")
        return None
    except requests.exceptions.Timeout:
        log(f"WARN: get_gateway_serial: timeout bij verbinding met {gateway_ip}")
        return None
    except Exception as e:
        log(f"WARN: get_gateway_serial: onverwachte fout: {type(e).__name__}: {e}")
        return None


def get_gateway_mac_fallback():
    """Detecteert het MAC-adres van de default gateway.
    Volgorde: ping (vult ARP-cache) → /proc/net/arp → arp -n → ip neigh show
    Geeft het MAC-adres als lowercase string terug, of None bij mislukking.
    """
    gateway_ip = get_gateway_ip()
    if not gateway_ip:
        log("WARN: get_gateway_mac_fallback: geen gateway IP beschikbaar")
        return None

    # Ping de gateway om de ARP-cache te vullen vóór de lookups
    reachable = ping_gateway(gateway_ip)
    if not reachable:
        log(f"WARN: get_gateway_mac_fallback: gateway {gateway_ip} niet bereikbaar via ping")

    # 1. /proc/net/arp — meest betrouwbaar, altijd aanwezig op Linux
    mac = get_mac_from_proc_arp(gateway_ip)
    if mac:
        log(f"INFO: get_gateway_mac_fallback: MAC via /proc/net/arp: {mac} (gateway={gateway_ip})")
        return mac
    log(f"WARN: get_gateway_mac_fallback: geen entry voor {gateway_ip} in /proc/net/arp")

    # 2. arp -n
    try:
        arp_result = subprocess.run(
            ["arp", "-n", gateway_ip],
            capture_output=True, text=True, timeout=5
        )
        mac_match = re.search(r"([0-9a-f]{2}(?::[0-9a-f]{2}){5})", arp_result.stdout, re.IGNORECASE)
        if mac_match:
            mac = mac_match.group(1).lower()
            log(f"INFO: get_gateway_mac_fallback: MAC via arp -n: {mac}")
            return mac
        log(f"WARN: get_gateway_mac_fallback: arp -n gaf geen MAC voor {gateway_ip}: {arp_result.stdout.strip()!r}")
    except Exception as e:
        log(f"WARN: get_gateway_mac_fallback: arp -n fout: {e}")

    # 3. ip neigh show
    try:
        neigh_result = subprocess.run(
            ["ip", "neigh", "show", gateway_ip],
            capture_output=True, text=True, timeout=5
        )
        mac_match = re.search(r"([0-9a-f]{2}(?::[0-9a-f]{2}){5})", neigh_result.stdout, re.IGNORECASE)
        if mac_match:
            mac = mac_match.group(1).lower()
            log(f"INFO: get_gateway_mac_fallback: MAC via ip neigh: {mac}")
            return mac
        log(f"WARN: get_gateway_mac_fallback: ip neigh gaf geen MAC voor {gateway_ip}: {neigh_result.stdout.strip()!r}")
    except Exception as e:
        log(f"WARN: get_gateway_mac_fallback: ip neigh fout: {e}")

    return None


def try_backend_heartbeat(version_raspberry, software_update):
    if not isinstance(runtime_config, dict) or not runtime_config:
        return False

    api_base_url = str(runtime_config.get("apiBaseUrl") or "").strip().rstrip("/")
    provisioning_id = str(runtime_config.get("provisioningId") or "").strip()

    if not api_base_url:
        return False

    heartbeat_url = f"{api_base_url}/device/heartbeat"
    payload = {
        "boxId": DOCUMENT_ID,
        "deviceName": DOCUMENT_ID,
        "softwareVersion": version_raspberry,
        "software": software_update
    }

    if provisioning_id:
        payload["provisioningId"] = provisioning_id

    gateway_mac = get_gateway_mac()
    if gateway_mac:
        payload["gatewayMac"] = gateway_mac

    try:
        response = requests.post(heartbeat_url, json=payload, timeout=20)
        if response.status_code != 200:
            log(f"WARN: backend heartbeat rejected: {response.status_code} | {response.text}")
            return False

        body = response.json() if response.content else {}
        item = body.get("item", {}) if isinstance(body, dict) else {}
        if isinstance(item, dict):
            if item.get("provisioningStatus"):
                runtime_config["status"] = item.get("provisioningStatus")
            if item.get("heartbeatAt"):
                runtime_config["lastHeartbeatAt"] = item.get("heartbeatAt")
        return True
    except Exception as e:
        log(f"WARN: backend heartbeat error: {e}")
        return False

def update_pi_status():
    global cached_config

    try:
        doc = box_doc_ref.get()
        current_data = doc.to_dict() if doc.exists else {}
        sw_cfg = current_data.get("software", {})

        latest_github = get_latest_github_tag()
        version_raspberry = get_running_version()
        target_version = sw_cfg.get("targetVersion", VERSION)

        # Als git fetch faalt, val terug op targetVersion zodat de heartbeat
        # leesbaar blijft en softwareUpdateRequested: true gewoon verwerkt wordt.
        if latest_github == "error":
            latest_github = target_version or VERSION
            log(f"WARN: GitHub tag fetch mislukt — latestGithub valt terug op targetVersion: {latest_github}")
        deployment_mode = sw_cfg.get("deploymentMode", "firestore")
        software_update_requested = bool(sw_cfg.get("softwareUpdateRequested", False))

        deployment_status = derive_deployment_status(version_raspberry, target_version)

        if software_action_in_progress:
            update_status = sw_cfg.get("updateStatus", "APPLYING")
            last_error = sw_cfg.get("lastError")
        else:
            update_status = derive_update_status(sw_cfg.get("updateStatus"), deployment_status)
            last_error = None if deployment_status == "ON_TARGET" else sw_cfg.get("lastError")

        nu = now_dt()

        software_update = {
            "latestGithub": latest_github,
            "versionRaspberry": version_raspberry,
            "targetVersion": target_version,
            "deploymentMode": deployment_mode,
            "deploymentStatus": deployment_status,
            "softwareUpdateRequested": software_update_requested,
            "updateStatus": update_status,
            "githubTagPattern": sw_cfg.get("githubTagPattern", get_github_tag_pattern()),
            "serviceName": sw_cfg.get("serviceName", "gridbox-listener.service"),
            "pipInstallOnDeploy": sw_cfg.get("pipInstallOnDeploy", True),
            "restartDelaySeconds": sw_cfg.get("restartDelaySeconds", 2),
            "gitCommitLocal": get_running_commit(),
            "lastHeartbeatIso": nu.isoformat(),
            "lastHeartbeatUnix": int(nu.timestamp()),
            "piModel": read_pi_model(),
            "platform": platform.platform(),
            "pythonVersion": platform.python_version(),
            "lastError": last_error
        }

        backend_heartbeat_ok = try_backend_heartbeat(version_raspberry, software_update)

        if not backend_heartbeat_ok:
            log("WARN: backend heartbeat failed, keeping direct Firestore sync only")

        box_doc_ref.set({
            "software": software_update,
            "status": "online",
            "updatedAt": nu.isoformat(),
            "updatedBy": f"gridbox-service-{VERSION}"
        }, merge=True)

        # Gateway detectie — schrijf altijd gatewayIp zodat detectie zichtbaar is in Firestore
        gateway_ip = get_gateway_ip()
        hw_update: dict = {"hardware.gatewayIp": gateway_ip or "unknown"}

        if gateway_ip:
            gateway_serial = get_gateway_serial()
            if gateway_serial:
                hw_update["hardware.gatewaySerial"] = gateway_serial
                log(f"INFO: gateway serial: {gateway_serial}")
            else:
                log(f"WARN: gateway serial niet beschikbaar voor {gateway_ip}")

            gateway_mac = get_gateway_mac_fallback()
            if gateway_mac:
                hw_update["hardware.gatewayMac"] = gateway_mac
                log(f"INFO: gateway MAC: {gateway_mac}")
            else:
                log(f"WARN: gateway MAC niet beschikbaar voor {gateway_ip}")

        box_doc_ref.update(hw_update)

        refresh_cached_config()
        log(
            f"ÃƒÂ¢Ã…Â¡Ã¢â€žÂ¢ÃƒÂ¯Ã‚Â¸Ã‚Â Heartbeat OK | latestGithub={latest_github} | "
            f"versionRaspberry={version_raspberry} | targetVersion={target_version} | "
            f"deploymentStatus={deployment_status} | updateStatus={update_status}"
        )

    except Exception as e:
        log(f"ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Sync fout: {e}")


# =========================================================
# SOFTWARE APPLY FLOW
# =========================================================

def maybe_process_software_request():
    global software_action_in_progress

    if not software_update_lock.acquire(blocking=False):
        return

    try:
        doc = box_doc_ref.get()
        data = doc.to_dict() if doc.exists else {}
        sw_cfg = data.get("software", {})

        software_update_requested = bool(sw_cfg.get("softwareUpdateRequested", False))
        target_version = sw_cfg.get("targetVersion")
        current_version = get_running_version()

        if not software_update_requested:
            return

        if not target_version:
            mark_update_failed("targetVersion ontbreekt.", target_version=None)
            return

        if current_version == target_version:
            write_software_fields({
                "softwareUpdateRequested": False,
                "updateStatus": "ON_TARGET",
                "deploymentStatus": "ON_TARGET",
                "lastError": None,
                "lastUpdateAttemptAt": now_iso()
            })
            log("ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¹ÃƒÂ¯Ã‚Â¸Ã‚Â softwareUpdateRequested was true, maar box draait al op targetVersion.")
            return

        log(f"ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â€šÂ¬ Software update gevraagd naar {target_version}")
        software_action_in_progress = True

        write_software_fields({
            "softwareUpdateRequested": False,
            "updateStatus": "APPLYING",
            "deploymentStatus": "MISMATCH",
            "lastError": None,
            "lastRequestedTargetVersion": target_version,
            "lastUpdateAttemptAt": now_iso()
        })

        ensure_repo_clean_for_checkout()

        if not ensure_target_tag_exists(target_version):
            raise RuntimeError(f"Tag bestaat niet in GitHub: {target_version}")

        checkout_target_version(target_version)
        maybe_install_requirements()

        write_software_fields({
            "softwareUpdateRequested": False,
            "updateStatus": "RESTARTING",
            "deploymentStatus": "MISMATCH",
            "lastError": None,
            "lastPreparedTargetVersion": target_version,
            "lastRestartRequestedAt": now_iso()
        })

        log(f"ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â Restart ingepland naar versie {target_version}")
        schedule_service_restart()

        time.sleep(1)
        os._exit(0)

    except Exception as e:
        mark_update_failed(str(e), target_version=target_version if 'target_version' in locals() else None)

    finally:
        if software_update_lock.locked():
            software_update_lock.release()


# =========================================================
# CAMERA HELPERS
# =========================================================

def get_camera_config():
    return cached_config.get("hardware", {}).get("camera", {})

def get_snapshot_collection_ref():
    return box_doc_ref.collection("snapshots")

def get_snapshot_change_threshold():
    cam_cfg = get_camera_config()
    try:
        return float(cam_cfg.get("changeDetectionThreshold", 6.0))
    except Exception:
        return 6.0

def build_small_snapshot(image):
    return image.convert("L").resize((64, 64), RESAMPLE_LANCZOS)

def analyze_snapshot_change(image):
    current_small = build_small_snapshot(image)
    threshold = get_snapshot_change_threshold()

    with snapshot_lock:
        previous_small = last_snapshot_small
        previous_id = last_snapshot_id

    if previous_small is None:
        return current_small, False, 0.0, previous_id, threshold

    diff = ImageChops.difference(current_small, previous_small)
    stat = ImageStat.Stat(diff)
    score = float(stat.mean[0]) if stat.mean else 0.0
    score = round(score, 4)
    change_detected = score >= threshold

    return current_small, change_detected, score, previous_id, threshold

def remember_snapshot_reference(small_image, snapshot_id):
    global last_snapshot_small, last_snapshot_id

    with snapshot_lock:
        last_snapshot_small = small_image
        last_snapshot_id = snapshot_id

def build_session_id():
    return f"session_{int(time.time() * 1000)}"

def start_snapshot_session():
    global current_session_id, session_started_at, last_saved_snapshot_at, last_snapshot_small, last_snapshot_id

    started_at = now_iso()
    session_id = build_session_id()

    with snapshot_lock:
        current_session_id = session_id
        session_started_at = started_at
        last_saved_snapshot_at = None
        last_snapshot_small = None
        last_snapshot_id = None

    log(f"Snapshot sessie gestart: {session_id}")
    return session_id

def end_snapshot_session():
    global current_session_id, session_started_at

    with snapshot_lock:
        session_id = current_session_id
        started_at = session_started_at
        current_session_id = None
        session_started_at = None

    if session_id:
        log(f"Snapshot sessie beÃƒÂ«indigd: {session_id}")

    return session_id, started_at

def get_snapshot_cooldown_seconds():
    cam_cfg = get_camera_config()
    try:
        return float(cam_cfg.get("saveCooldownSeconds", 10))
    except Exception:
        return 10.0

def get_force_save_threshold_multiplier():
    cam_cfg = get_camera_config()
    try:
        return float(cam_cfg.get("forceSaveThresholdMultiplier", 2.0))
    except Exception:
        return 2.0

def should_store_snapshot(phase, change_detected, change_score, threshold):
    global last_saved_snapshot_at

    forced_phases = {"startup_test", "open_start", "open_end"}
    if phase in forced_phases:
        return True, "forced_phase"

    now_ts = time.time()
    cooldown_seconds = get_snapshot_cooldown_seconds()
    force_multiplier = get_force_save_threshold_multiplier()
    force_threshold = float(threshold) * float(force_multiplier)

    with snapshot_lock:
        previous_saved_at = last_saved_snapshot_at

    cooldown_ok = previous_saved_at is None or (now_ts - previous_saved_at) >= cooldown_seconds
    force_save = float(change_score) >= force_threshold

    if not change_detected and not force_save:
        return False, "below_threshold"

    if cooldown_ok:
        return True, "change_detected"

    if force_save:
        return True, "force_save"

    return False, "cooldown_active"


# =========================================================
# CAMERA
# =========================================================

def take_snapshot(phase="manual", sequence_number=None):
    global last_saved_snapshot_at

    cam_cfg = get_camera_config()
    if not cam_cfg.get("enabled", False):
        return

    url = cam_cfg.get("snapshotUrl")
    if not url:
        return

    try:
        auth = None
        if cam_cfg.get("username"):
            auth = HTTPBasicAuth(cam_cfg.get("username"), cam_cfg.get("password"))

        resp = requests.get(url, auth=auth, timeout=10)
        if resp.status_code != 200:
            log(f"Camera gaf status {resp.status_code}")
            return

        content_type = resp.headers.get("Content-Type", "image/jpeg")
        captured_at = now_iso()

        image = Image.open(BytesIO(resp.content))
        image.load()

        width, height = image.size
        small_image, change_detected, change_score, previous_snapshot_id, threshold = analyze_snapshot_change(image)

        capture_reason = phase
        if phase not in {"startup_test", "open_start", "open_end"}:
            capture_reason = "change_detected"

        should_store, store_reason = should_store_snapshot(
            phase=phase,
            change_detected=change_detected,
            change_score=change_score,
            threshold=threshold
        )

        if not should_store:
            log(
                f"Snapshot overgeslagen | fase={phase} | seq={sequence_number} | "
                f"score={change_score} | reden={store_reason}"
            )
            return

        timestamp_ms = int(time.time() * 1000)
        filename = f"snapshot_{timestamp_ms}.jpg"
        snapshot_id = safe_doc_id(filename.rsplit(".", 1)[0])

        with snapshot_lock:
            session_id = current_session_id
            session_started = session_started_at

        storage_path = f"snapshots/{DOCUMENT_ID}/{filename}"
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(storage_path)
        blob.upload_from_string(resp.content, content_type=content_type)

        with state_lock:
            current_box_open = bool(box_is_open)

        snapshot_payload = {
            "snapshotId": snapshot_id,
            "boxId": DOCUMENT_ID,
            "sessionId": session_id,
            "sessionStartedAt": session_started,
            "filename": filename,
            "storagePath": storage_path,
            "bucket": BUCKET_NAME,
            "capturedAt": captured_at,
            "phase": phase,
            "captureReason": capture_reason,
            "storeReason": store_reason,
            "sequenceNumber": int(sequence_number) if sequence_number is not None else None,
            "changeDetected": bool(change_detected),
            "changeScore": float(change_score),
            "changeThreshold": float(threshold),
            "previousSnapshotId": previous_snapshot_id,
            "contentType": content_type,
            "sizeBytes": int(len(resp.content)),
            "width": int(width),
            "height": int(height),
            "boxWasOpen": current_box_open,
            "source": "listener-camera",
            "createdAt": captured_at,
            "updatedAt": captured_at
        }

        snapshot_payload = {k: v for k, v in snapshot_payload.items() if v is not None}

        try:
            get_snapshot_collection_ref().document(snapshot_id).set(snapshot_payload, merge=True)
            indexed_text = "indexed"
        except Exception as metadata_error:
            indexed_text = "storage-only"
            log(f"Snapshot metadata opslaan mislukt: {metadata_error}")

        remember_snapshot_reference(small_image, snapshot_id)

        with snapshot_lock:
            last_saved_snapshot_at = time.time()

        log(
            f"Snapshot opgeslagen | fase={phase} | reason={capture_reason} | seq={sequence_number} | "
            f"score={change_score} | storeReason={store_reason} | {indexed_text}"
        )

    except Exception as e:
        log(f"Camera fout: {e}")

def snapshot_loop():
    global snapshot_thread_running

    try:
        cam = get_camera_config()
        interval = float(cam.get("snapshotIntervalSeconds", 5))
        duration = float(cam.get("postCloseSnapshotDurationSeconds", 30))

        sequence_number = 0
        post_close_until = None

        while True:
            with state_lock:
                currently_open = bool(box_is_open)

            if currently_open:
                phase = "open"
                post_close_until = None
            else:
                if post_close_until is None:
                    post_close_until = time.time() + duration

                if time.time() >= post_close_until:
                    break

                phase = "post-close"

            sequence_number += 1
            take_snapshot(phase=phase, sequence_number=sequence_number)
            time.sleep(interval)

    finally:
        end_snapshot_session()
        with state_lock:
            snapshot_thread_running = False

def ensure_snapshot_thread():
    global snapshot_thread_running

    with state_lock:
        if snapshot_thread_running:
            return
        snapshot_thread_running = True

    threading.Thread(target=snapshot_loop, daemon=True).start()


# =========================================================
# COMMAND HANDLING
# =========================================================

def stop_shutter_motors():
    shutter_open.off()
    shutter_close.off()
    log("ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂºÃ¢â‚¬Ëœ Motor stroom uitgeschakeld")

def mark_command(doc_ref, status, extra=None):
    if not doc_ref:
        return

    payload = {
        "status": status,
        "updatedAt": now_iso()
    }

    if status == "processing":
        payload["startedAt"] = now_iso()
    elif status == "completed":
        payload["completedAt"] = now_iso()
    elif status == "failed":
        payload["failedAt"] = now_iso()

    if isinstance(extra, dict):
        payload.update(extra)

    try:
        doc_ref.set(payload, merge=True)
    except Exception as e:
        log(f"ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Command status opslaan mislukt: {e}")

def handle_command(doc_ref, data):
    global shutter_motor_timer, light_off_timer

    with command_lock:
        cmd = (data.get("command") or "").upper()
        source = data.get("phone") or data.get("source") or "Onbekend"

        try:
            if doc_ref:
                mark_command(doc_ref, "processing")

            hw_cfg = cached_config.get("hardware", {})
            shutter_cfg = hw_cfg.get("shutter", {})
            lighting_cfg = hw_cfg.get("lighting", {})

            if cmd == "OPEN":
                log(f"OPEN commando ontvangen (Bron: {source})")

                with state_lock:
                    was_open_before = bool(box_is_open)

                shutter_close.off()
                time.sleep(0.1)
                shutter_open.on()

                if lighting_cfg.get("onWhenOpen", True):
                    light.on()

                if not was_open_before:
                    start_snapshot_session()

                update_box_state(True, source)

                if not was_open_before:
                    take_snapshot(phase="open_start", sequence_number=0)

                ensure_snapshot_thread()

                duration = float(shutter_cfg.get("openDurationSeconds", 30))
                cancel_timer(shutter_motor_timer)
                shutter_motor_timer = start_daemon_timer(duration, stop_shutter_motors)

                cancel_timer(light_off_timer)

            elif cmd == "CLOSE":
                log(f"CLOSE commando ontvangen (Bron: {source})")

                with state_lock:
                    was_open_before = bool(box_is_open)

                shutter_open.off()
                time.sleep(0.1)
                shutter_close.on()

                if was_open_before:
                    take_snapshot(phase="open_end", sequence_number=999999)

                update_box_state(False, source)

                duration = float(shutter_cfg.get("closeDurationSeconds", 30))
                cancel_timer(shutter_motor_timer)
                shutter_motor_timer = start_daemon_timer(duration, stop_shutter_motors)

                light_delay = float(lighting_cfg.get("lightOffDelaySeconds", 60))
                cancel_timer(light_off_timer)
                light_off_timer = start_daemon_timer(light_delay, lambda: light.off())

            else:
                raise ValueError(f"Onbekend commando: {cmd}")

            if doc_ref:
                mark_command(doc_ref, "completed")

        except Exception as e:
            log(f"ÃƒÂ¢Ã‚ÂÃ…â€™ Commando fout: {e}")
            if doc_ref:
                mark_command(doc_ref, "failed", {"error": str(e)})

def on_commands_snapshot(snapshot, changes, read_time):
    for ch in changes:
        if ch.type.name not in ["ADDED", "MODIFIED"]:
            continue

        data = ch.document.to_dict() or {}
        if data.get("status") != "pending":
            continue

        handle_command(ch.document.reference, data)


# =========================================================
# INITIALISATIE
# =========================================================

try:
    runtime_config = load_runtime_config() or {}
    bootstrap_config = load_bootstrap_config() or {}

    try:
        box_config, DOCUMENT_ID = load_box_config()
    except Exception:
        box_config = runtime_config or bootstrap_config or {}
        DOCUMENT_ID = (
            box_config.get("deviceId")
            or box_config.get("boxId")
            or bootstrap_config.get("boxId")
        )

    if not DOCUMENT_ID:
        raise RuntimeError("deviceId of boxId ontbreekt in lokale config")

    if bootstrap_config and not runtime_config:
        try_backend_bootstrap_claim()
        runtime_config = load_runtime_config() or runtime_config

    if isinstance(runtime_config, dict) and runtime_config:
        box_config = deep_merge_missing(box_config, runtime_config)

    REPO_ROOT = get_repo_root()

    creds = service_account.Credentials.from_service_account_file(KEY_PATH)
    storage_client = storage.Client(credentials=creds)
    db = get_db(creds)
    box_doc_ref = db.collection("boxes").document(DOCUMENT_ID)

except Exception as e:
    log(f"❌ Startup fout: {e}")
    raise SystemExit(1)

STARTUP_GIT_COMMIT = get_repo_commit()

shutter_open = I2CRelay(I2C_BUS, I2C_ADDRESS, SHUTTER_OPEN_RELAY_ID, "Rolluik omhoog")
shutter_close = I2CRelay(I2C_BUS, I2C_ADDRESS, SHUTTER_CLOSE_RELAY_ID, "Rolluik omlaag")
light = I2CRelay(I2C_BUS, I2C_ADDRESS, LIGHT_RELAY_ID, "Lamp")

stop_shutter_motors()
light.off()

try:
    bootstrap_if_needed()
    update_pi_status()

    log("ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¸ Startup test snapshot uitvoeren...")
    threading.Thread(
        target=lambda: take_snapshot(phase="startup-test", sequence_number=0),
        daemon=True
    ).start()

except Exception as e:
    log(f"ÃƒÂ¢Ã‚ÂÃ…â€™ Bootstrap/init fout: {e}")

query = box_doc_ref.collection("commands").where(filter=FieldFilter("status", "==", "pending"))
query_watch = query.on_snapshot(on_commands_snapshot)


# =========================================================
# FYSIEKE KNOP
# =========================================================

def handle_physical_button():
    with state_lock:
        target = "CLOSE" if box_is_open else "OPEN"

    log(f"ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‹Å“ Fysieke knop ingedrukt. Actie: {target}")
    handle_command(None, {"command": target, "source": "Fysieke Knop"})

if platform.system() != "Windows" and GPIO_AVAILABLE:
    try:
        btn = Button(CLOSE_BUTTON_PIN, pin_factory=BUTTON_FACTORY, pull_up=True, bounce_time=0.2)
        btn.when_pressed = handle_physical_button
        log(f"ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‹Å“ Slimme toggle-schakelaar actief op GPIO {CLOSE_BUTTON_PIN}")
    except Exception as e:
        log(f"ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Schakelaar fout: {e}")


# =========================================================
# MAIN LOOP
# =========================================================

next_heartbeat_at = 0
next_software_poll_at = 0
_claim_permanently_rejected = False

try:
    while True:
        now_ts = time.time()

        if now_ts >= next_software_poll_at:
            maybe_process_software_request()
            next_software_poll_at = now_ts + float(
                box_config.get("software", {}).get("softwarePollIntervalSeconds", SOFTWARE_POLL_INTERVAL_SECONDS)
            )

        if now_ts >= next_heartbeat_at:
            if bootstrap_config and not runtime_config and not _claim_permanently_rejected:
                _claim_result = try_backend_bootstrap_claim()
                if _claim_result is True:
                    runtime_config = load_runtime_config() or runtime_config
                    if isinstance(runtime_config, dict) and runtime_config:
                        box_config = deep_merge_missing(box_config, runtime_config)
                elif _claim_result is None:
                    _claim_permanently_rejected = True
            update_pi_status()
            next_heartbeat_at = now_ts + HEARTBEAT_INTERVAL_SECONDS

        time.sleep(1)

except Exception:
    log("ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂºÃ¢â‚¬Ëœ Stop.")

finally:
    cancel_timer(light_off_timer)
    cancel_timer(shutter_motor_timer)
    stop_shutter_motors()
    light.off()





