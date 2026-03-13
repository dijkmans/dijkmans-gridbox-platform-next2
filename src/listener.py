import json
import os
import platform
import subprocess
import threading
import time
from datetime import datetime
from zoneinfo import ZoneInfo

import requests
from requests.auth import HTTPBasicAuth
from google.cloud import storage
from google.cloud.firestore_v1.base_query import FieldFilter
from google.oauth2 import service_account
from google.cloud.firestore import GeoPoint

from db_manager import get_db

# =========================================================
# GRIDBOX SERVICE - MASTER v1.0.44
# Behoudt de VOLLEDIGE originele structuur en regellengte.
# Wijzigt enkel: Firestore veldnamen + GitHub versie-uitlezer.
# =========================================================

VERSION = "1.0.44"
KEY_PATH = "service-account.json"
BUCKET_NAME = "gridbox-platform.firebasestorage.app"
TIMEZONE = ZoneInfo("Europe/Brussels")

# I2C & GPIO Config
I2C_BUS = 1
I2C_ADDRESS = "0x10"
SHUTTER_OPEN_RELAY_ID = "0x01"   # Relais 1: Motor Omhoog
SHUTTER_CLOSE_RELAY_ID = "0x02"  # Relais 2: Motor Omlaag
LIGHT_RELAY_ID = "0x03"          # Relais 3: Verlichting
CLOSE_BUTTON_PIN = 8             # GPIO 8 (Pin 24)

cached_config = {}
box_is_open = False
snapshot_thread_running = False

state_lock = threading.Lock()
light_off_timer = None
shutter_motor_timer = None

# =========================================================
# HARDWARE LAYER (ONGEWIJZIGD)
# =========================================================

GPIO_AVAILABLE = False
BUTTON_FACTORY = None

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
            print("ℹ️ GPIO via standaard fallback.")
    except Exception as e:
        print(f"⚠️ GPIO niet beschikbaar: {e}")

class I2CRelay:
    def __init__(self, bus, address, relay_id, name):
        self.bus = str(bus)
        self.address = str(address)
        self.relay_id = str(relay_id)
        self.name = name

    def _run(self, value, action_text):
        if platform.system() == "Windows": return
        cmd = ["sudo", "-n", "i2cset", "-y", self.bus, self.address, self.relay_id, value]
        try:
            subprocess.run(cmd, check=True, capture_output=True)
            print(f"  [I2C] {self.name} -> {action_text}")
        except:
            print(f"  [FOUT] Hardware weigert: {self.name}")

    def on(self): self._run("0xFF", "AAN (KLIK)")
    def off(self): self._run("0x00", "UIT")

# =========================================================
# HELPERS (GITHUB PARSER TOEGEVOEGD)
# =========================================================

def get_git_commit():
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"]).decode().strip()
    except:
        return "unknown"

def get_remote_version_number():
    """Nieuwe functie: Plukt 'VERSION = ' tekst van GitHub"""
    try:
        subprocess.run(["git", "fetch"], capture_output=True, timeout=10)
        filename = os.path.basename(__file__)
        remote_content = subprocess.check_output(["git", "show", f"origin/main:{filename}"]).decode()
        for line in remote_content.splitlines():
            if "VERSION =" in line:
                return line.split('"')[1]
        return "unknown"
    except:
        return "error"

def read_pi_model():
    if platform.system() == "Windows": return "Windows-Simulatie"
    model_paths = ["/proc/device-tree/model", "/sys/firmware/devicetree/base/model"]
    for path in model_paths:
        try:
            with open(path, "rb") as f:
                return f.read().replace(b"\x00", b"").decode("utf-8").strip()
        except: pass
    return platform.platform()

def load_box_config():
    try:
        with open("box_config.json", "r", encoding="utf-8") as f:
            data = json.load(f)
        return data, data.get("deviceId")
    except Exception as e:
        raise RuntimeError(f"Config fout: {e}")

def now_iso():
    return datetime.now(TIMEZONE).isoformat()

def cancel_timer(timer_obj):
    if timer_obj:
        try: timer_obj.cancel()
        except: pass

def start_daemon_timer(seconds, callback):
    t = threading.Timer(float(seconds), callback)
    t.daemon = True
    t.start()
    return t

# =========================================================
# STATUS & SYNC (VOLLEDIGE INJECTIE BEHOUDEN)
# =========================================================

def update_pi_status():
    global cached_config
    try:
        doc = box_doc_ref.get()
        current_data = doc.to_dict() if doc.exists else {}
        sw_cfg = current_data.get('software', {})
        
        nu = datetime.now(TIMEZONE)
        
        # We halen de echte versie van GitHub op
        github_version = get_remote_version_number()
        
        # De heringerichte software map volgens jouw wens
        full_software_map = {
            "versionRaspberry": VERSION,            # Voorheen currentVersion
            "latestGithub": github_version,         # Voorheen latestAvailable
            "targetVersion": sw_cfg.get('targetVersion', VERSION),
            "updateStatus": sw_cfg.get('updateStatus', "IDLE"),
            "gitCommitLocal": get_git_commit(),
            "lastHeartbeatIso": nu.isoformat(),
            "lastHeartbeatUnix": int(nu.timestamp()),
            "piModel": read_pi_model(),
            "platform": platform.platform(),
            "pythonVersion": platform.python_version()
        }

        # Update het hoofddocument met de guardian-injectie
        box_doc_ref.set({
            "software": full_software_map,
            "status": "online",
            "hardware": {
                "shutter": {
                    "openDurationSeconds": 30,
                    "closeDurationSeconds": 30
                },
                "lighting": {
                    "lightOffDelaySeconds": 60,
                    "onWhenOpen": True
                },
                "camera": {
                    "enabled": True,
                    "snapshotIntervalSeconds": 5,
                    "postCloseSnapshotDurationSeconds": 30
                }
            }
        }, merge=True)

        # DE INJECTIE LOGICA (Exact behouden zoals je vroeg)
        box_doc_ref.collection("authorizedUsers").document("dummy_user").set({
            "email": "piet@voorbeeld.be",
            "name": "Piet (Sjabloon)",
            "phoneNumber": "+32000000000",
            "role": "admin"
        }, merge=True)

        box_doc_ref.collection("commands").document("dummy_command").set({
            "boxId": DOCUMENT_ID,
            "command": "OPEN",
            "phone": "+32000000000",
            "status": "completed",
            "timestamp": nu.isoformat()
        }, merge=True)

        box_doc_ref.collection("customers").document("cust_powergrid").set({
            "name": "Powergrid"
        }, merge=True)

        box_doc_ref.collection("shares").document("dummy_share").set({
            "accessLevel": "full",
            "active": True,
            "createdAt": nu.isoformat(),
            "description": "Klant komt fiets afhalen (Sjabloon)",
            "name": "Piet",
            "status": "pending"
        }, merge=True)

        box_doc_ref.collection("sites").document("site_geel_01").set({
            "customerId": "cust_powergrid",
            "name": "Geel Hoofdkantoor",
            "location": {
                "street": "Winkelomseheide",
                "number": "111",
                "postalCode": "2440",
                "city": "Geel",
                "country": "BE",
                "geo": GeoPoint(51.1677, 4.3352) 
            }
        }, merge=True)

        cached_config = box_doc_ref.get().to_dict()
        print(f"⚙️ Sync & Datastructuur hersteld (Pi={VERSION} | GitHub={github_version})")
    except Exception as e:
        print(f"⚠️ Sync fout: {e}")

# =========================================================
# CAMERA & ACTIONS (VOLLEDIG BEHOUDEN)
# =========================================================

def take_snapshot():
    cam_cfg = cached_config.get("hardware", {}).get("camera", {})
    if not cam_cfg.get("enabled", False): return
    url = cam_cfg.get("snapshotUrl")
    if not url: return

    try:
        auth = HTTPBasicAuth(cam_cfg.get("username"), cam_cfg.get("password")) if cam_cfg.get("username") else None
        resp = requests.get(url, auth=auth, timeout=10)
        if resp.status_code == 200:
            filename = f"snapshot_{int(time.time())}.jpg"
            bucket = storage_client.bucket(BUCKET_NAME)
            blob = bucket.blob(f"snapshots/{DOCUMENT_ID}/{filename}")
            blob.upload_from_string(resp.content, content_type="image/jpeg")
            print(f"📸 Snapshot geüpload.")
    except Exception as e:
        print(f"❌ Camera fout: {e}")

def snapshot_loop():
    global snapshot_thread_running
    try:
        cam = cached_config.get("hardware", {}).get("camera", {})
        interval = float(cam.get("snapshotIntervalSeconds", 5))
        duration = float(cam.get("postCloseSnapshotDurationSeconds", 30))
        
        while True:
            with state_lock:
                if not box_is_open: break
            take_snapshot()
            time.sleep(interval)
        
        end_time = time.time() + duration
        while time.time() < end_time:
            take_snapshot()
            time.sleep(interval)
    finally:
        with state_lock: snapshot_thread_running = False

def ensure_snapshot_thread():
    global snapshot_thread_running
    with state_lock:
        if snapshot_thread_running: return
        snapshot_thread_running = True
    threading.Thread(target=snapshot_loop, daemon=True).start()

def stop_shutter_motors():
    shutter_open.off()
    shutter_close.off()
    print("🛑 Motor stroom uitgeschakeld (Timer voltooid)")

def handle_command(doc_ref, data):
    global box_is_open, shutter_motor_timer, light_off_timer
    cmd = (data.get("command") or "").upper()
    phone = data.get("phone")
    
    try:
        hw_cfg = cached_config.get("hardware", {})
        shutter_cfg = hw_cfg.get("shutter", {})
        
        if cmd == "OPEN":
            with state_lock: box_is_open = True
            print(f"🔓 OPEN commando ontvangen (Bron: {phone})")
            shutter_close.off()
            time.sleep(0.1)
            shutter_open.on()
            light.on()
            ensure_snapshot_thread()
            duration = float(shutter_cfg.get("openDurationSeconds", 30))
            cancel_timer(shutter_motor_timer)
            shutter_motor_timer = start_daemon_timer(duration, stop_shutter_motors)
            cancel_timer(light_off_timer)
            
        elif cmd == "CLOSE":
            with state_lock: box_is_open = False
            print(f"🔒 CLOSE commando ontvangen (Bron: {phone})")
            shutter_open.off()
            time.sleep(0.1)
            shutter_close.on()
            duration = float(shutter_cfg.get("closeDurationSeconds", 30))
            cancel_timer(shutter_motor_timer)
            shutter_motor_timer = start_daemon_timer(duration, stop_shutter_motors)
            light_delay = float(hw_cfg.get("lighting", {}).get("lightOffDelaySeconds", 60))
            cancel_timer(light_off_timer)
            light_off_timer = start_daemon_timer(light_delay, lambda: light.off())
            
        if doc_ref: doc_ref.delete()
    except Exception as e:
        print(f"❌ Commando fout: {e}")

# =========================================================
# INITIALISATIE & MAIN (PIN FIX + TOGGLE)
# =========================================================

try:
    box_config, DOCUMENT_ID = load_box_config()
    creds = service_account.Credentials.from_service_account_file(KEY_PATH)
    storage_client = storage.Client(credentials=creds)
    db = get_db(creds)
    box_doc_ref = db.collection("boxes").document(DOCUMENT_ID)
except Exception as e:
    print(f"❌ Startup Fout: {e}"); raise SystemExit(1)

shutter_open = I2CRelay(I2C_BUS, I2C_ADDRESS, SHUTTER_OPEN_RELAY_ID, "Rolluik OMHOOG")
shutter_close = I2CRelay(I2C_BUS, I2C_ADDRESS, SHUTTER_CLOSE_RELAY_ID, "Rolluik OMLAAG")
light = I2CRelay(I2C_BUS, I2C_ADDRESS, LIGHT_RELAY_ID, "Lamp")

stop_shutter_motors()
light.off()

# Heartbeat loop
threading.Thread(target=lambda: [update_pi_status() or time.sleep(300) for _ in iter(int, 1)], daemon=True).start()

# Firestore Watcher
query = box_doc_ref.collection("commands").where(filter=FieldFilter("status", "==", "pending"))
query_watch = query.on_snapshot(lambda s, c, t: [handle_command(ch.document.reference, ch.document.to_dict()) for ch in c if ch.type.name in ["ADDED", "MODIFIED"]])

# SLIMME TOGGLE LOGICA VOOR HARDWARE KNOP
def handle_physical_button():
    with state_lock:
        target = "CLOSE" if box_is_open else "OPEN"
    print(f"🔘 Fysieke knop ingedrukt. Actie: {target}")
    handle_command(None, {"command": target, "phone": "Fysieke Knop"})

if platform.system() != "Windows" and GPIO_AVAILABLE:
    try:
        # Gebruik GPIO 8 conform schema 
        btn = Button(CLOSE_BUTTON_PIN, pin_factory=BUTTON_FACTORY, pull_up=True, bounce_time=0.2)
        btn.when_pressed = handle_physical_button
        print(f"🔘 Slimme toggle-schakelaar actief op GPIO {CLOSE_BUTTON_PIN}")
    except Exception as e:
        print(f"⚠️ Schakelaar fout: {e}")

try:
    while True: time.sleep(1)
except:
    print("\n🛑 Stop.")
finally:
    cancel_timer(light_off_timer)
    cancel_timer(shutter_motor_timer)
    stop_shutter_motors()
    light.off()