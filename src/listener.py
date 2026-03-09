import json
import platform
import threading
import time
import os
import requests
from requests.auth import HTTPBasicAuth
from google.cloud import firestore, storage
from google.oauth2 import service_account
from google.cloud.firestore_v1.base_query import FieldFilter
from db_manager import get_db

# --- CONFIGURATIE ---
VERSION = "1.0.25-FIXED"
KEY_PATH = "service-account.json"
BUCKET_NAME = "gridbox-platform.firebasestorage.app"
door_is_open = False 

# --- Authenticatie ---
if not os.path.exists(KEY_PATH): exit("❌ Sleutelbestand niet gevonden!")
creds = service_account.Credentials.from_service_account_file(KEY_PATH)
storage_client = storage.Client(credentials=creds)
db = get_db(creds) 

# --- Hardware Setup (Verbose Simulator) ---
class MockGPIO:
    BCM, OUT, IN, HIGH, LOW = "BCM", "OUT", "IN", True, False
    PUD_UP, FALLING = "PUD_UP", "FALLING"
    def setmode(self, mode): pass
    def setup(self, pin, mode, pull_up_down=None): pass
    def output(self, pin, state): print(f"  [HARDWARE] Pin {pin} -> {'ON' if state else 'OFF'}")
    def add_event_detect(self, pin, edge, callback, bouncetime): pass
    def cleanup(self): pass

GPIO = MockGPIO() if platform.system() == "Windows" else __import__('RPi.GPIO').GPIO
DOOR_PIN, LIGHT_PIN, CLOSE_BTN_PIN = 17, 22, 27
GPIO.setmode(GPIO.BCM)
GPIO.setup(DOOR_PIN, GPIO.OUT)
GPIO.setup(LIGHT_PIN, GPIO.OUT)
GPIO.setup(CLOSE_BTN_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)

# --- Config & Init ---
try:
    with open('box_config.json', 'r') as f:
        DOCUMENT_ID = json.load(f).get('deviceId')
except: exit("❌ box_config.json ontbreekt")

def get_hw_config():
    doc = db.collection('boxes').document(DOCUMENT_ID).get().to_dict()
    return doc.get('hardware', {})

# --- Camera & Opslag (Direct Geheugen) ---
def take_snapshot():
    cam_cfg = get_hw_config().get('camera', {})
    if not cam_cfg.get('enabled', False): return
    try:
        auth = HTTPBasicAuth(cam_cfg.get('username'), cam_cfg.get('password'))
        resp = requests.get(cam_cfg.get('snapshotUrl'), auth=auth, timeout=10)
        if resp.status_code == 200:
            filename = f"snapshot_{int(time.time())}.jpg"
            bucket = storage_client.bucket(BUCKET_NAME)
            blob = bucket.blob(f"snapshots/{DOCUMENT_ID}/{filename}")
            blob.upload_from_string(resp.content, content_type='image/jpeg')
            print(f"☁️ [CLOUD] Geüpload: {filename}")
    except Exception as e: print(f"❌ FOUT in take_snapshot: {e}")

def snapshot_loop():
    global door_is_open
    hw = get_hw_config()
    cam = hw.get('camera', {})
    interval = cam.get('snapshotIntervalSeconds', 5)
    duration = cam.get('postCloseSnapshotDurationSeconds', 30)

    print(f"📸 [CAMERA] Fase 1 (Open): Monitoring actief (Interval: {interval}s)")
    while door_is_open:
        take_snapshot()
        time.sleep(interval)
        
    print(f"🔒 [CAMERA] Box gesloten. Fase 2 (Naloop): {duration}s")
    end_time = time.time() + duration
    while time.time() < end_time:
        take_snapshot()
        time.sleep(interval)
    print("📸 [CAMERA] Monitoring volledig gestopt.")

# --- Acties ---
def close_box(trigger_source):
    global door_is_open
    print(f"🔒 [ACTIE] Box sluiten (Bron: {trigger_source})")
    door_is_open = False
    GPIO.output(DOOR_PIN, False)
    
    # Licht management
    delay = get_hw_config().get('lighting', {}).get('lightOffDelaySeconds', 60)
    print(f"💡 [TIMER] Licht gaat over {delay}s uit.")
    threading.Timer(float(delay), lambda: GPIO.output(LIGHT_PIN, GPIO.LOW)).start()

def handle_command(cmd, trigger):
    global door_is_open
    if cmd == "OPEN":
        print("🔓 [ACTIE] Box openen...")
        door_is_open = True
        GPIO.output(DOOR_PIN, True)
        GPIO.output(LIGHT_PIN, GPIO.HIGH)
        
        # --- AUTO-CLOSE LOGICA (De fix) ---
        hw = get_hw_config()
        auto_close = hw.get('autoClose', {})
        if auto_close.get('enabled', False):
            delay = float(auto_close.get('delaySeconds', 30))
            print(f"⏱️ [TIMER] Auto-close actief: sluit over {delay}s")
            threading.Timer(delay, lambda: handle_command("CLOSE", "AutoClose")).start()
        # ----------------------------------
        
        threading.Thread(target=snapshot_loop, daemon=True).start()
    elif cmd == "CLOSE":
        close_box(trigger)

# --- Start Debug Console ---
print(f"\n--- [DEBUG CONSOLE] {DOCUMENT_ID} ---")
print("Typ: 'o'(Open), 'c'(Close), 'b'(Knop-druk), 'q'(Quit)")

def input_loop():
    while True:
        cmd = input("\n> ").lower()
        if cmd == 'o': handle_command("OPEN", "Simulatie")
        elif cmd == 'c': handle_command("CLOSE", "Simulatie")
        elif cmd == 'b': close_box("PhysicalButton")
        elif cmd == 'q': os._exit(0)

threading.Thread(target=input_loop, daemon=True).start()

# --- Listener ---
query = db.collection('boxes').document(DOCUMENT_ID).collection('commands').where(filter=FieldFilter('status', '==', 'pending'))
query.on_snapshot(lambda col, chg, read: [handle_command(c.document.get('command').upper(), "SMS") for c in chg if c.type.name == 'ADDED' and c.document.get('status') == 'pending'])

try:
    while True: time.sleep(1)
except KeyboardInterrupt:
    GPIO.cleanup()
    print("\n👋 Gestopt.")