import json
from db_manager import get_db
from google.cloud import firestore, storage
from google.cloud.firestore_v1.base_query import FieldFilter
from google.oauth2 import service_account
import requests
from requests.auth import HTTPBasicAuth
import platform
import threading
import time
import subprocess
import sys
import os

# --- NIEUWE HARDWARE LIBRARY (I2C) ---
if platform.system() != "Windows":
    class I2CRelay:
        def __init__(self, bus, address, relay_id, name):
            self.bus = str(bus)
            self.address = str(address)
            self.relay_id = str(relay_id)
            self.name = name

        def on(self):
            # 0xFF is relais AAN (KLIK!)
            try:
                subprocess.run(["sudo", "i2cset", "-y", self.bus, self.address, self.relay_id, "0xFF"], check=True)
                print(f"  [HARDWARE] {self.name} (I2C {self.relay_id}) is nu AAN (KLIK)")
            except subprocess.CalledProcessError as e:
                print(f"  [FOUT] Kon {self.name} niet aanzetten: {e}")

        def off(self):
            # 0x00 is relais UIT
            try:
                subprocess.run(["sudo", "i2cset", "-y", self.bus, self.address, self.relay_id, "0x00"], check=True)
                print(f"  [HARDWARE] {self.name} (I2C {self.relay_id}) is nu UIT")
            except subprocess.CalledProcessError as e:
                print(f"  [FOUT] Kon {self.name} niet uitzetten: {e}")

    # We kunnen de fysieke GPIO-knop nog steeds via gpiozero laten lopen als die wel op Pin 27 zit
    try:
        from gpiozero import Button
        from gpiozero.pins.lgpio import LGPIOFactory
        factory = LGPIOFactory()
    except ImportError:
        pass # Geen GPIO bibliotheek beschikbaar
else:
    # Simulatie voor Windows
    class MockDevice:
        def __init__(self, name, **kwargs): self.name = name
        def on(self): print(f"  [SIM] {self.name} is nu AAN (Relais KLIK)")
        def off(self): print(f"  [SIM] {self.name} is nu UIT")
    I2CRelay = lambda bus, address, relay_id, name: MockDevice(name)
    Button = MockDevice

# --- CONFIGURATIE ---
VERSION = "1.0.30"
cached_config = {}
door_is_open = False
KEY_PATH = "service-account.json"
BUCKET_NAME = "gridbox-platform.firebasestorage.app"

try:
    with open('box_config.json', 'r') as f:
        config_data = json.load(f)
        DOCUMENT_ID = config_data.get('deviceId')
except FileNotFoundError:
    print("❌ FOUT: 'box_config.json' niet gevonden.")
    exit(1)

# --- Cloud Clients ---
if not os.path.exists(KEY_PATH): exit("❌ Sleutelbestand niet gevonden!")
creds = service_account.Credentials.from_service_account_file(KEY_PATH)
storage_client = storage.Client(credentials=creds)
db = get_db(creds)

# --- Hardware Initialisatie ---
# I2C Relais Instellingen.
# Adres: 0x10. Relais 1 (0x01) is de deur, Relais 2 (0x02) is de lamp.
door = I2CRelay(bus=1, address="0x10", relay_id="0x01", name="Deur")
light = I2CRelay(bus=1, address="0x10", relay_id="0x02", name="Lamp")

# Zet ze voor de zekerheid UIT bij het opstarten
door.off()
light.off()

# Fysieke knop op Pin 27 (Dit blijft GPIO, tenzij de knop ook op de I2C bus zit)
if platform.system() != "Windows" and 'Button' in globals():
    try:
        close_button = Button(27, pull_up=True, bounce_time=0.1)
        close_button.when_pressed = lambda: close_box(trigger_source="PhysicalButton")
        print("🔘 Fysieke sluitknop geconfigureerd op GPIO 27.")
    except Exception as e:
        print(f"⚠️ Kon fysieke knop niet instellen: {e}")

# --- Camera & Snapshot Logica ---
def take_snapshot():
    cam_cfg = cached_config.get('hardware', {}).get('camera', {})
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
    except Exception as e: print(f"❌ FOUT in camera: {e}")

def snapshot_loop():
    global door_is_open
    cam = cached_config.get('hardware', {}).get('camera', {})
    interval = cam.get('snapshotIntervalSeconds', 3)
    duration = cam.get('postCloseSnapshotDurationSeconds', 30)

    print(f"📸 [CAMERA] Monitoring actief...")
    while door_is_open:
        take_snapshot()
        time.sleep(interval)
        
    print(f"🔒 [CAMERA] Box gesloten. Naloop fase gestart.")
    end_time = time.time() + duration
    while time.time() < end_time:
        take_snapshot()
        time.sleep(interval)
    print("📸 [CAMERA] Monitoring gestopt.")

# --- Actie Functies ---
def turn_light_off():
    light.off()
    print("💡 [STATUS] Licht UIT.")

def close_box(trigger_source="System"):
    global door_is_open
    door_is_open = False
    door.off() # Relais laat los via I2C
    print(f"🔒 Box aan het sluiten... (Trigger: {trigger_source})")
    
    delay = cached_config.get('hardware', {}).get('lighting', {}).get('lightOffDelaySeconds', 60)
    threading.Timer(float(delay), turn_light_off).start()

def is_authorized(phone_number):
    try:
        is_share = db.collection('boxes').document(DOCUMENT_ID).collection('shares').document(phone_number).get().exists
        is_auth = db.collection('boxes').document(DOCUMENT_ID).collection('authorizedUsers').document(phone_number).get().exists
        return is_share or is_auth
    except Exception: return False

def handle_command(doc_ref, data):
    global door_is_open
    command = data.get('command', '').upper()
    phone = data.get('phone') 
    
    if not is_authorized(phone):
        print(f"🚫 Toegang geweigerd voor {phone}")
        doc_ref.update({'status': 'denied'})
        return
        
    try:
        if command == "OPEN":
            door_is_open = True
            door.on() # Relais KLIKT nu via I2C
            print(f"🔓 [ACTION] Deur geopend voor {phone}")
            
            hw_config = cached_config.get('hardware', {})
            if hw_config.get('lighting', {}).get('onWhenOpen', True): 
                light.on()
                
            auto_close = hw_config.get('autoClose', {})
            if auto_close.get('enabled', False):
                delay = auto_close.get('delaySeconds', 60)
                threading.Timer(float(delay), lambda: close_box("AutoClose")).start()
            
            threading.Thread(target=snapshot_loop, daemon=True).start()
            doc_ref.update({'status': 'completed'})
            
        elif command == "CLOSE":
            close_box(trigger_source="Remote")
            doc_ref.update({'status': 'completed'})
            
    except Exception as e:
        print(f"❌ Fout bij uitvoeren commando: {e}")
        doc_ref.update({'status': 'error', 'error': str(e)})

# --- Status & Sync ---
def update_pi_status():
    global cached_config
    doc_ref = db.collection('boxes').document(DOCUMENT_ID)
    try:
        doc_ref.update({'software.lastHeartbeat': round(time.time() / 3600, 2), 'software.currentVersion': VERSION})
        full_doc = doc_ref.get().to_dict()
        if full_doc and full_doc != cached_config:
            cached_config = full_doc
            print(f"⚙️ Sync voltooid! (v{VERSION})")
    except Exception as e: print(f"⚠️ Sync fout: {e}")
    threading.Timer(300, update_pi_status).start()

# --- Main ---
print(f"🚀 Gridbox Service Starten (ID: {DOCUMENT_ID})...")
update_pi_status()

query = db.collection('boxes').document(DOCUMENT_ID).collection('commands').where(filter=FieldFilter('status', '==', 'pending'))
query_watch = query.on_snapshot(lambda col, chg, read: [handle_command(c.document.reference, c.document.to_dict()) for c in chg if c.type.name in ['ADDED', 'MODIFIED']])

try:
    while True: time.sleep(1)
except KeyboardInterrupt:
    print("\n👋 Stopteken ontvangen.")