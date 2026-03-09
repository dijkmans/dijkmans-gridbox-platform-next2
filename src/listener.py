import json
from db_manager import get_db
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
import platform
import threading
import time

# --- CONFIGURATIE ---
cached_config = {}

try:
    with open('box_config.json', 'r') as f:
        config_data = json.load(f)
        DOCUMENT_ID = config_data.get('deviceId')
except FileNotFoundError:
    print("❌ FOUT: 'box_config.json' niet gevonden.")
    exit(1)

# --- Hardware Setup ---
if platform.system() == "Windows":
    class MockGPIO:
        BCM = "BCM"; OUT = "OUT"; HIGH = True; LOW = False
        def setmode(self, mode): pass
        def setup(self, pin, mode): pass
        def output(self, pin, state): print(f"  [SIMULATIE] GPIO pin {pin} is nu {'HIGH' if state else 'LOW'}")
        def cleanup(self): pass
    GPIO = MockGPIO()
else:
    import RPi.GPIO as GPIO

DOOR_PIN = 17
LIGHT_PIN = 22
GPIO.setmode(GPIO.BCM)
GPIO.setup(DOOR_PIN, GPIO.OUT)
GPIO.setup(LIGHT_PIN, GPIO.OUT)

db = get_db()

# --- Sync Functies ---
def get_box_full_doc():
    try:
        doc = db.collection('boxes').document(DOCUMENT_ID).get()
        if doc.exists: return doc.to_dict()
    except Exception as e: print(f"⚠️ Fout bij ophalen document: {e}")
    return {}

def update_pi_status():
    global cached_config
    doc_ref = db.collection('boxes').document(DOCUMENT_ID)
    doc = doc_ref.get()
    defaults = {
        "info": {"customer": "PENDING", "site": "PENDING"},
        "hardware": {
            "lighting": {"onWhenOpen": True, "lightOffDelaySeconds": 60},
            "autoClose": {"enabled": False, "delaySeconds": 60}
        }
    }
    if not doc.exists: doc_ref.set(defaults)
    else:
        data = doc.to_dict()
        updates = {}
        if 'info' not in data: updates['info'] = defaults['info']
        if 'hardware' not in data: updates['hardware'] = defaults['hardware']
        else:
            hw = data.get('hardware', {})
            if 'autoClose' in hw and 'delayMs' in hw['autoClose']:
                updates['hardware.autoClose.delaySeconds'] = int(hw['autoClose']['delayMs'] / 1000)
                doc_ref.update({'hardware.autoClose.delayMs': firestore.DELETE_FIELD})
            if 'lighting' in hw and 'lightOffDelaySeconds' not in hw['lighting']:
                updates['hardware.lighting.lightOffDelaySeconds'] = 60
        if updates: doc_ref.update(updates)

    full_doc = get_box_full_doc()
    if full_doc and full_doc != cached_config:
        cached_config = full_doc
        print(f"⚙️ Sync voltooid!")

    try: doc_ref.update({'status.lastHeartbeat': time.time()})
    except Exception as e: print(f"⚠️ Fout bij heartbeat: {e}")
    threading.Timer(300, update_pi_status).start()

# --- Centrale Hardware Functies ---
def turn_light_off():
    GPIO.output(LIGHT_PIN, GPIO.LOW)
    print("💡 [STATUS] Licht is nu uitgeschakeld.")

def close_box(trigger_source="SMS"):
    print(f"🔒 Box aan het sluiten... (Trigger: {trigger_source})")
    GPIO.output(DOOR_PIN, False)
    
    hw_config = cached_config.get('hardware', {})
    lighting = hw_config.get('lighting', {})
    delay = lighting.get('lightOffDelaySeconds', 60)
    
    print(f"💡 [STATUS] Licht blijft aan voor {delay} seconden.")
    threading.Timer(float(delay), turn_light_off).start()

def is_authorized(phone_number):
    try:
        is_share = db.collection('boxes').document(DOCUMENT_ID).collection('shares').document(phone_number).get().exists
        is_auth = db.collection('boxes').document(DOCUMENT_ID).collection('authorizedUsers').document(phone_number).get().exists
        return is_share or is_auth
    except Exception as e: return False

# --- Commando Afhandeling ---
def handle_command(doc_ref, data):
    command = data.get('command', '').upper()
    phone = data.get('phone') 
    
    if not is_authorized(phone):
        doc_ref.update({'status': 'denied'})
        return

    try:
        if command == "OPEN":
            GPIO.output(DOOR_PIN, True)
            hw_config = cached_config.get('hardware', {})
            
            # Licht aansturen
            if hw_config.get('lighting', {}).get('onWhenOpen', True): 
                GPIO.output(LIGHT_PIN, GPIO.HIGH)
                print("🔓 Box geopend. [STATUS] Licht is AAN.")
            
            # AUTO-CLOSE
            auto_close = hw_config.get('autoClose', {})
            if auto_close.get('enabled', False):
                delay = auto_close.get('delaySeconds', 60)
                print(f"⏱️ [AUTO-CLOSE] Box sluit automatisch over {delay} seconden.")
                threading.Timer(float(delay), lambda: close_box("AutoClose")).start()

            doc_ref.update({'status': 'completed'})
            
        elif command == "CLOSE":
            close_box(trigger_source="SMS")
            doc_ref.update({'status': 'completed'})
            
    except Exception as e:
        doc_ref.update({'status': 'error', 'error': str(e)})

# --- Start ---
update_pi_status()
print(f"👂 Luisterend naar {DOCUMENT_ID}...")
query = db.collection('boxes').document(DOCUMENT_ID).collection('commands').where(filter=FieldFilter('status', '==', 'pending'))
query_watch = query.on_snapshot(lambda col, chg, read: [handle_command(c.document.reference, c.document.to_dict()) for c in chg if c.type.name in ['ADDED', 'MODIFIED']])

try: input()
except KeyboardInterrupt:
    GPIO.cleanup()
    print("\n👋 Luisteraar gestopt.")