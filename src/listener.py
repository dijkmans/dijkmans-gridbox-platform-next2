import json
import os
import platform
import subprocess
import threading
import time
from datetime import datetime, timezone

import requests
from requests.auth import HTTPBasicAuth
from google.cloud import storage
from google.cloud.firestore_v1.base_query import FieldFilter
from google.oauth2 import service_account

from db_manager import get_db

# =========================================================
# GRIDBOX SERVICE - MASTER EDITIE
# 1 image voor alles (Pi 3B / 3B+ / 4 / 5)
# =========================================================

VERSION = "1.0.31"
KEY_PATH = "service-account.json"
BUCKET_NAME = "gridbox-platform.firebasestorage.app"

# Bekabeling is overal hetzelfde
I2C_BUS = 1
I2C_ADDRESS = "0x10"
DOOR_RELAY_ID = "0x01"
LIGHT_RELAY_ID = "0x02"
CLOSE_BUTTON_PIN = 27

cached_config = {}
door_is_open = False
snapshot_thread_running = False

state_lock = threading.Lock()
light_off_timer = None
auto_close_timer = None

# =========================================================
# GPIO / HARDWARE LAYER
# =========================================================

GPIO_AVAILABLE = False
BUTTON_FACTORY = None
BUTTON_IMPORT_ERROR = None

if platform.system() != "Windows":
    try:
        from gpiozero import Button
        GPIO_AVAILABLE = True

        try:
            from gpiozero.pins.lgpio import LGPIOFactory
            BUTTON_FACTORY = LGPIOFactory()
            print("✅ GPIO via lgpio beschikbaar.")
        except Exception:
            BUTTON_FACTORY = None
            print("ℹ️ GPIO via standaard gpiozero fallback.")
    except Exception as e:
        BUTTON_IMPORT_ERROR = str(e)
        print(f"⚠️ GPIO niet beschikbaar: {BUTTON_IMPORT_ERROR}")

class I2CRelay:
    def __init__(self, bus, address, relay_id, name):
        self.bus = str(bus)
        self.address = str(address)
        self.relay_id = str(relay_id)
        self.name = name

    def _build_cmd(self, value):
        if platform.system() == "Windows":
            return None

        if hasattr(os, "geteuid") and os.geteuid() == 0:
            return ["i2cset", "-y", self.bus, self.address, self.relay_id, value]

        return ["sudo", "-n", "i2cset", "-y", self.bus, self.address, self.relay_id, value]

    def _run(self, value, action_text):
        if platform.system() == "Windows":
            print(f"  [SIM] {self.name} is nu {action_text}")
            return

        cmd = self._build_cmd(value)
        try:
            subprocess.run(cmd, check=True, capture_output=True, text=True)
            print(f"  [HARDWARE] {self.name} (I2C {self.relay_id}) is nu {action_text}")
        except FileNotFoundError:
            print(f"  [FOUT] i2cset niet gevonden voor {self.name}")
        except subprocess.CalledProcessError as e:
            stderr = (e.stderr or "").strip()
            print(f"  [FOUT] Kon {self.name} niet schakelen: {stderr if stderr else e}")

    def on(self):
        self._run("0xFF", "AAN (KLIK)")

    def off(self):
        self._run("0x00", "UIT")

class MockButton:
    def __init__(self, *args, **kwargs):
        self.when_pressed = None

# =========================================================
# HELPERS
# =========================================================

def read_pi_model():
    if platform.system() == "Windows":
        return "Windows-simulatie"

    model_paths = [
        "/proc/device-tree/model",
        "/sys/firmware/devicetree/base/model",
    ]

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
    except FileNotFoundError:
        raise RuntimeError("box_config.json niet gevonden.")
    except json.JSONDecodeError as e:
        raise RuntimeError(f"box_config.json is geen geldige JSON: {e}")

    device_id = (data.get("deviceId") or "").strip()
    if not device_id:
        raise RuntimeError("deviceId ontbreekt in box_config.json")
    return data, device_id

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def cancel_timer(timer_obj):
    if timer_obj is not None:
        try:
            timer_obj.cancel()
        except Exception:
            pass

def start_daemon_timer(seconds, callback):
    t = threading.Timer(float(seconds), callback)
    t.daemon = True
    t.start()
    return t

# =========================================================
# CONFIG LADEN
# =========================================================

try:
    box_config, DOCUMENT_ID = load_box_config()
except RuntimeError as e:
    print(f"❌ FOUT: {e}")
    raise SystemExit(1)

PI_MODEL = read_pi_model()

print("======================================")
print(" GRIDBOX SERVICE")
print("======================================")
print(f"Versie        : {VERSION}")
print(f"Device ID     : {DOCUMENT_ID}")
print(f"Pi model      : {PI_MODEL}")
print(f"Python        : {platform.python_version()}")
print("======================================")

# =========================================================
# CLOUD CLIENTS
# =========================================================

if not os.path.exists(KEY_PATH):
    raise SystemExit("❌ Sleutelbestand niet gevonden: service-account.json")

creds = service_account.Credentials.from_service_account_file(KEY_PATH)
storage_client = storage.Client(credentials=creds)
db = get_db(creds)

box_doc_ref = db.collection("boxes").document(DOCUMENT_ID)

# =========================================================
# HARDWARE INITIALISATIE
# =========================================================

door = I2CRelay(bus=I2C_BUS, address=I2C_ADDRESS, relay_id=DOOR_RELAY_ID, name="Deur")
light = I2CRelay(bus=I2C_BUS, address=I2C_ADDRESS, relay_id=LIGHT_RELAY_ID, name="Lamp")

door.off()
light.off()

close_button = None

if platform.system() != "Windows" and GPIO_AVAILABLE:
    try:
        if BUTTON_FACTORY is not None:
            close_button = Button(CLOSE_BUTTON_PIN, pull_up=True, bounce_time=0.1, pin_factory=BUTTON_FACTORY)
        else:
            close_button = Button(CLOSE_BUTTON_PIN, pull_up=True, bounce_time=0.1)
        print(f"🔘 Fysieke sluitknop geconfigureerd op GPIO {CLOSE_BUTTON_PIN}.")
    except Exception as e:
        print(f"⚠️ Kon fysieke knop niet instellen: {e}")
else:
    if platform.system() == "Windows":
        close_button = MockButton()
    else:
        print("⚠️ Geen fysieke knop actief, gpiozero niet beschikbaar.")

# =========================================================
# CAMERA & SNAPSHOTS
# =========================================================

def take_snapshot():
    cam_cfg = cached_config.get("hardware", {}).get("camera", {})
    if not cam_cfg.get("enabled", False):
        return

    snapshot_url = cam_cfg.get("snapshotUrl")
    username = cam_cfg.get("username")
    password = cam_cfg.get("password")

    if not snapshot_url:
        print("⚠️ Camera aan maar snapshotUrl ontbreekt.")
        return

    try:
        auth = HTTPBasicAuth(username, password) if username else None
        resp = requests.get(snapshot_url, auth=auth, timeout=10)

        if resp.status_code == 200:
            filename = f"snapshot_{int(time.time())}.jpg"
            bucket = storage_client.bucket(BUCKET_NAME)
            blob = bucket.blob(f"snapshots/{DOCUMENT_ID}/{filename}")
            blob.upload_from_string(resp.content, content_type="image/jpeg")
            print(f"☁️ [CLOUD] Snapshot geüpload: {filename}")
        else:
            print(f"⚠️ Camera gaf statuscode {resp.status_code}")
    except Exception as e:
        print(f"❌ FOUT in camera: {e}")

def snapshot_loop():
    global snapshot_thread_running
    try:
        cam = cached_config.get("hardware", {}).get("camera", {})
        interval = float(cam.get("snapshotIntervalSeconds", 3))
        duration = float(cam.get("postCloseSnapshotDurationSeconds", 30))

        print("📸 [CAMERA] Monitoring actief...")
        while True:
            with state_lock:
                still_open = door_is_open
            if not still_open:
                break
            take_snapshot()
            time.sleep(interval)

        print("🔒 [CAMERA] Box gesloten. Naloop fase gestart.")
        end_time = time.time() + duration
        while time.time() < end_time:
            take_snapshot()
            time.sleep(interval)
        print("📸 [CAMERA] Monitoring gestopt.")
    finally:
        with state_lock:
            snapshot_thread_running = False

def ensure_snapshot_thread():
    global snapshot_thread_running
    with state_lock:
        if snapshot_thread_running:
            return
        snapshot_thread_running = True
    thread = threading.Thread(target=snapshot_loop, daemon=True)
    thread.start()

# =========================================================
# ACTIES
# =========================================================

def turn_light_off():
    light.off()
    print("💡 [STATUS] Licht UIT.")

def close_box(trigger_source="System"):
    global door_is_open, auto_close_timer, light_off_timer

    with state_lock:
        if not door_is_open:
            print(f"ℹ️ Box was al gesloten. Trigger: {trigger_source}")
        door_is_open = False

    cancel_timer(auto_close_timer)
    auto_close_timer = None

    door.off()
    print(f"🔒 Box aan het sluiten... (Trigger: {trigger_source})")

    delay = float(cached_config.get("hardware", {}).get("lighting", {}).get("lightOffDelaySeconds", 60))
    cancel_timer(light_off_timer)
    light_off_timer = start_daemon_timer(delay, turn_light_off)

def is_authorized(phone_number):
    if not phone_number:
        return False
    try:
        share_exists = box_doc_ref.collection("shares").document(phone_number).get().exists
        auth_exists = box_doc_ref.collection("authorizedUsers").document(phone_number).get().exists
        return share_exists or auth_exists
    except Exception as e:
        print(f"⚠️ Authorisatiecheck mislukt: {e}")
        return False

def handle_open_command(doc_ref, phone):
    global door_is_open, auto_close_timer, light_off_timer

    with state_lock:
        was_open = door_is_open
        door_is_open = True

    cancel_timer(light_off_timer)
    light_off_timer = None

    door.on()
    print(f"🔓 [ACTION] Deur geopend voor {phone}")

    hw_config = cached_config.get("hardware", {})
    if hw_config.get("lighting", {}).get("onWhenOpen", True):
        light.on()

    auto_close = hw_config.get("autoClose", {})
    if auto_close.get("enabled", False):
        delay = float(auto_close.get("delaySeconds", 60))
        cancel_timer(auto_close_timer)
        auto_close_timer = start_daemon_timer(delay, lambda: close_box("AutoClose"))

    if not was_open:
        ensure_snapshot_thread()

    # FIX: Commando succesvol? Gooi het weg uit de cloud (voorkomt vervuiling!)
    doc_ref.delete()
    print("🧹 [CLEANUP] OPEN commando verwerkt en verwijderd uit Firestore.")

def handle_close_command(doc_ref):
    close_box(trigger_source="Remote")
    
    # FIX: Commando succesvol? Gooi het weg uit de cloud
    doc_ref.delete()
    print("🧹 [CLEANUP] CLOSE commando verwerkt en verwijderd uit Firestore.")

def handle_command(doc_ref, data):
    command = (data.get("command") or "").upper()
    phone = data.get("phone")

    if not is_authorized(phone):
        print(f"🚫 Toegang geweigerd voor {phone}")
        # Fouten bewaren we wél in de cloud voor debugging
        doc_ref.update({
            "status": "denied",
            "processedAt": now_iso()
        })
        return

    try:
        if command == "OPEN":
            handle_open_command(doc_ref, phone)
        elif command == "CLOSE":
            handle_close_command(doc_ref)
        else:
            print(f"⚠️ Onbekend commando: {command}")
            doc_ref.update({
                "status": "error",
                "error": f"Onbekend commando: {command}",
                "processedAt": now_iso()
            })
    except Exception as e:
        print(f"❌ Fout bij uitvoeren commando: {e}")
        try:
            doc_ref.update({
                "status": "error",
                "error": str(e),
                "processedAt": now_iso()
            })
        except Exception:
            pass

# =========================================================
# STATUS & SYNC (HEARTBEAT LOOP)
# =========================================================

def update_pi_status():
    global cached_config
    try:
        full_doc = box_doc_ref.get().to_dict() or {}
        if full_doc != cached_config:
            cached_config = full_doc
            print(f"⚙️ Sync voltooid! (v{VERSION})")

        box_doc_ref.update({
            "software.currentVersion": VERSION,
            "software.lastHeartbeatUnix": int(time.time()),
            "software.lastHeartbeatIso": now_iso(),
            "software.platform": platform.platform(),
            "software.pythonVersion": platform.python_version(),
            "software.piModel": PI_MODEL,
        })
    except Exception as e:
        print(f"⚠️ Sync fout: {e}")

# FIX: Één stabiele achtergrond-thread in plaats van matroesjka's
def heartbeat_loop():
    print("💓 [HEARTBEAT] Achtergrond-synchronisatie gestart (elke 5 minuten).")
    while True:
        update_pi_status()
        time.sleep(300)

# =========================================================
# CALLBACKS
# =========================================================

def on_firestore_snapshot(col_snapshot, changes, read_time):
    for change in changes:
        if change.type.name not in ["ADDED", "MODIFIED"]:
            continue

        data = change.document.to_dict() or {}
        status = (data.get("status") or "").lower()

        if status == "pending":
            handle_command(change.document.reference, data)

def on_physical_button_pressed():
    close_box(trigger_source="PhysicalButton")

if close_button is not None:
    try:
        close_button.when_pressed = on_physical_button_pressed
    except Exception as e:
        print(f"⚠️ Kon knop-callback niet instellen: {e}")

# =========================================================
# MAIN
# =========================================================

print(f"🚀 Gridbox Service starten voor {DOCUMENT_ID}...")

# Start de nieuwe stabiele heartbeat in de achtergrond
heartbeat_thread = threading.Thread(target=heartbeat_loop, daemon=True)
heartbeat_thread.start()

query = box_doc_ref.collection("commands").where(
    filter=FieldFilter("status", "==", "pending")
)

query_watch = query.on_snapshot(on_firestore_snapshot)

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("\n👋 Stopteken ontvangen.")
except Exception as e:
    print(f"\n❌ Onverwachte fout in hoofdloop: {e}")
finally:
    try:
        query_watch.unsubscribe()
    except Exception:
        pass

    cancel_timer(light_off_timer)
    cancel_timer(auto_close_timer)

    try:
        door.off()
        light.off()
    except Exception:
        pass

    print("🛑 Gridbox Service gestopt.")