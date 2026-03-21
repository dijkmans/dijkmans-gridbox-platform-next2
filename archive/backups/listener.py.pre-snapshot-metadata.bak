import json
import os
import platform
import re
import shlex
import subprocess
import threading
import time
from datetime import datetime
from zoneinfo import ZoneInfo

import requests
from requests.auth import HTTPBasicAuth
from google.cloud import storage
from google.cloud.firestore import GeoPoint
from google.cloud.firestore_v1.base_query import FieldFilter
from google.oauth2 import service_account

from db_manager import get_db

# =========================================================
# GRIDBOX SERVICE - MASTER v1.0.47
# Één script:
# - bootstrap bij opstart
# - runtime voor commands / knop / camera / heartbeat
# - GEEN auto-update
# - WEL update / downgrade via Firestore:
#     software.targetVersion
#     software.softwareUpdateRequested = true
#
# NIEUW in v1.0.47: 
# - Directe test-snapshot bij opstart om JWT fouten te vangen.
# =========================================================

VERSION = "v1.0.47"
KEY_PATH = "service-account.json"
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

state_lock = threading.Lock()
command_lock = threading.Lock()
software_update_lock = threading.Lock()

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
        log(f"⚠️ cached_config kon niet vernieuwd worden: {e}")

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
        log(f"⚠️ GitHub tag uitlezen mislukt: {e}")
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
    run_cmd_checked(["git", "fetch", "--tags", "origin"], cwd=REPO_ROOT, timeout=20)

    result = run_cmd(
        ["git", "rev-parse", "-q", "--verify", f"refs/tags/{tag_name}"],
        cwd=REPO_ROOT
    )
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
        [python_exec, "-m", "pip", "install", "-r", requirements_path],
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
    log(f"❌ Software update mislukt: {message}")


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
            "postCloseSnapshotDurationSeconds": camera_cfg.get("postCloseSnapshotDurationSeconds", 30)
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
    log(f"🏢 Customer verzekerd: customers/{customer_id}")
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
    log(f"📍 Site verzekerd: sites/{site_id}")
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
    log(f"👤 Bootstrap admin verzekerd: boxes/{DOCUMENT_ID}/authorizedUsers/{user_id}")

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
        log(f"🪞 Legacy customer mirror gezet onder box: {customer_id}")

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
        log(f"🪞 Legacy site mirror gezet onder box: {site_id}")

def bootstrap_if_needed():
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
    log(f"🧱 Bootstrap gecontroleerd voor boxes/{DOCUMENT_ID}")

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
        log(f"⚠️ Kon state niet opslaan: {e}")

def load_box_state_from_firestore():
    global box_is_open
    try:
        doc = box_doc_ref.get()
        data = doc.to_dict() if doc.exists else {}
        with state_lock:
            box_is_open = bool(data.get("state", {}).get("boxIsOpen", False))
        log(f"📦 Herstelde box_is_open = {box_is_open}")
    except Exception as e:
        log(f"⚠️ Kon box state niet laden: {e}")


# =========================================================
# HEARTBEAT + SOFTWARE STATUS
# =========================================================

def update_pi_status():
    global cached_config

    try:
        doc = box_doc_ref.get()
        current_data = doc.to_dict() if doc.exists else {}
        sw_cfg = current_data.get("software", {})

        latest_github = get_latest_github_tag()
        version_raspberry = get_running_version()
        target_version = sw_cfg.get("targetVersion", VERSION)
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

        box_doc_ref.set({
            "software": software_update,
            "status": "online",
            "updatedAt": nu.isoformat(),
            "updatedBy": f"gridbox-service-{VERSION}"
        }, merge=True)

        refresh_cached_config()
        log(
            f"⚙️ Heartbeat OK | latestGithub={latest_github} | "
            f"versionRaspberry={version_raspberry} | targetVersion={target_version} | "
            f"deploymentStatus={deployment_status} | updateStatus={update_status}"
        )

    except Exception as e:
        log(f"⚠️ Sync fout: {e}")


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
            log("ℹ️ softwareUpdateRequested was true, maar box draait al op targetVersion.")
            return

        log(f"🚀 Software update gevraagd naar {target_version}")
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

        log(f"🔁 Restart ingepland naar versie {target_version}")
        schedule_service_restart()

        time.sleep(1)
        os._exit(0)

    except Exception as e:
        mark_update_failed(str(e), target_version=target_version if 'target_version' in locals() else None)

    finally:
        if software_update_lock.locked():
            software_update_lock.release()


# =========================================================
# CAMERA
# =========================================================

def take_snapshot():
    cam_cfg = cached_config.get("hardware", {}).get("camera", {})
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
        if resp.status_code == 200:
            filename = f"snapshot_{int(time.time())}.jpg"
            bucket = storage_client.bucket(BUCKET_NAME)
            blob = bucket.blob(f"snapshots/{DOCUMENT_ID}/{filename}")
            blob.upload_from_string(resp.content, content_type="image/jpeg")
            log("📸 Snapshot geüpload.")
        else:
            log(f"❌ Camera gaf status {resp.status_code}")
    except Exception as e:
        log(f"❌ Camera fout: {e}")

def snapshot_loop():
    global snapshot_thread_running

    try:
        cam = cached_config.get("hardware", {}).get("camera", {})
        interval = float(cam.get("snapshotIntervalSeconds", 5))
        duration = float(cam.get("postCloseSnapshotDurationSeconds", 30))

        while True:
            with state_lock:
                if not box_is_open:
                    break
            take_snapshot()
            time.sleep(interval)

        end_time = time.time() + duration
        while time.time() < end_time:
            take_snapshot()
            time.sleep(interval)

    finally:
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
    log("🛑 Motor stroom uitgeschakeld")

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
        log(f"⚠️ Command status opslaan mislukt: {e}")

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
                log(f"🔓 OPEN commando ontvangen (Bron: {source})")

                shutter_close.off()
                time.sleep(0.1)
                shutter_open.on()

                if lighting_cfg.get("onWhenOpen", True):
                    light.on()

                update_box_state(True, source)
                ensure_snapshot_thread()

                duration = float(shutter_cfg.get("openDurationSeconds", 30))
                cancel_timer(shutter_motor_timer)
                shutter_motor_timer = start_daemon_timer(duration, stop_shutter_motors)

                cancel_timer(light_off_timer)

            elif cmd == "CLOSE":
                log(f"🔒 CLOSE commando ontvangen (Bron: {source})")

                shutter_open.off()
                time.sleep(0.1)
                shutter_close.on()

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
            log(f"❌ Commando fout: {e}")
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
    box_config, DOCUMENT_ID = load_box_config()
    if not DOCUMENT_ID:
        raise RuntimeError("deviceId ontbreekt in box_config.json")

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
    
    # --- NIEUW: STARTUP TEST SNAPSHOT ---
    log("📸 Startup test snapshot uitvoeren...")
    threading.Thread(target=take_snapshot, daemon=True).start()
    # ------------------------------------

except Exception as e:
    log(f"❌ Bootstrap/init fout: {e}")

query = box_doc_ref.collection("commands").where(filter=FieldFilter("status", "==", "pending"))
query_watch = query.on_snapshot(on_commands_snapshot)


# =========================================================
# FYSIEKE KNOP
# =========================================================

def handle_physical_button():
    with state_lock:
        target = "CLOSE" if box_is_open else "OPEN"

    log(f"🔘 Fysieke knop ingedrukt. Actie: {target}")
    handle_command(None, {"command": target, "source": "Fysieke Knop"})

if platform.system() != "Windows" and GPIO_AVAILABLE:
    try:
        btn = Button(CLOSE_BUTTON_PIN, pin_factory=BUTTON_FACTORY, pull_up=True, bounce_time=0.2)
        btn.when_pressed = handle_physical_button
        log(f"🔘 Slimme toggle-schakelaar actief op GPIO {CLOSE_BUTTON_PIN}")
    except Exception as e:
        log(f"⚠️ Schakelaar fout: {e}")


# =========================================================
# MAIN LOOP
# =========================================================

next_heartbeat_at = 0
next_software_poll_at = 0

try:
    while True:
        now_ts = time.time()

        if now_ts >= next_software_poll_at:
            maybe_process_software_request()
            next_software_poll_at = now_ts + float(
                box_config.get("software", {}).get("softwarePollIntervalSeconds", SOFTWARE_POLL_INTERVAL_SECONDS)
            )

        if now_ts >= next_heartbeat_at:
            update_pi_status()
            next_heartbeat_at = now_ts + HEARTBEAT_INTERVAL_SECONDS

        time.sleep(1)

except Exception:
    log("🛑 Stop.")

finally:
    cancel_timer(light_off_timer)
    cancel_timer(shutter_motor_timer)
    stop_shutter_motors()
    light.off()