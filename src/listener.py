import json
from db_manager import get_db
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
import platform
import threading
import time
import subprocess
import sys
import os

# --- CONFIGURATIE ---
VERSION = "1.0.9"
cached_config = {}
light_timer = None 
processed_commands = set() # Het geheugen van het script

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
        BCM = "BCM"; OUT = "OUT"; IN = "IN"; HIGH = True; LOW = False
        PUD_UP = "PUD_UP"; FALLING = "FALLING"
        def setmode(self, mode): pass
        def setup(self, pin, mode, pull_up_down=None): pass
        def output(self, pin, state): print(f"  [SIMULATIE] GPIO pin {pin} is nu {'HIGH' if state else 'LOW'}")
        def add_event_detect(self, pin, edge, callback, bouncetime): pass
        def cleanup(self): pass
    GPIO = MockGPIO()
else:
    import RPi.GPIO as GPIO

DOOR_PIN = 17
LIGHT_PIN = 22
CLOSE_BTN_PIN = 27 

GPIO.setmode(GPIO.BCM)
GPIO.setup(DOOR_PIN, GPIO.OUT)
GPIO.setup(LIGHT_PIN, GPIO.OUT)
GPIO.setup(CLOSE_BTN_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)

db = get_db()

# --- Callback voor Fysieke Knop ---
def physical_close_callback(channel):
    print("🔘 [PHYSICAL] Fysieke sluit-knop ingedrukt!")
    close_box(trigger_source="PhysicalButton")

GPIO.add_event_detect(CLOSE_BTN_PIN, GPIO.FALLING, callback=physical_close_callback, bouncetime=300)

# --- Utility & OTA Functies ---
def get_git_revision_hash():
    try:
        return subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD']).decode('ascii').strip()
    except Exception:
        return "unknown"

def get_latest_git_tag():
    try:
        tag = subprocess.check_output(['git', 'describe', '--tags', '--abbrev=0']).decode('ascii').strip()
        return tag.replace('v', '') 
    except Exception:
        return VERSION

def perform_update(target_version):
    print(f"🚀 [OTA] Update proces gestart naar versie {target_version}...")
    doc_ref = db.collection('boxes').document(DOCUMENT_ID)
    try:
        doc_ref.update({'software.updateStatus': 'UPDATING'})
        subprocess.check_call(['git', 'fetch', '--tags'])
        tag_name = f"v{target_version}"
        subprocess.check_call(['git', 'checkout', tag_name])
        
        print(f"✅ Succesvol gewisseld naar {tag_name}")
        doc_ref.update({
            'software.updateStatus': 'SUCCESS', 
            'software.currentVersion': target_version
        })
        print("🔄 Herstarten...")
        os.execv(sys.executable, ['python'] + sys.argv)
    except Exception as e:
        print(f"❌ Update gefaald: {e}")
        doc_ref.update({'software.updateStatus': 'FAILED', 'software.error': str(e)})

def check_for_updates(data):
    software = data.get('software', {})
    target_version = software.get('targetVersion', VERSION)
    update_status = software.get('updateStatus', 'IDLE')
    
    latest_git = get_latest_git_tag()
    if software.get('latestAvailable') != latest_git:
        db.collection('boxes').document(DOCUMENT_ID).update({'software.latestAvailable': latest_git})

    if update_status == 'READY_TO_UPDATE' and target_version != VERSION:
        print(f"📡 Update commando ontvangen! Van {VERSION} naar {target_version}")
        perform_update(target_version)
    elif update_status == 'READY_TO_UPDATE' and target_version == VERSION:
        db.collection('boxes').document(DOCUMENT_ID).update({'software.updateStatus': 'IDLE'})

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
    hours_now = round(time.time() / 3600, 2)
    
    if not doc.exists:
        doc_ref.set({
            "software": {
                "lastHeartbeat": hours_now,
                "currentVersion": VERSION,
                "gitCommit": get_git_revision_hash(),
                "updateStatus": "IDLE",
                "targetVersion": VERSION,
                "latestAvailable": VERSION
            }
        })
    else:
        data = doc.to_dict()
        check_for_updates(data)
        try:
            doc_ref.update({
                'software.lastHeartbeat': hours_now,
                'software.currentVersion': VERSION,
                'software.gitCommit': get_git_revision_hash(),
                'software.error': '' 
            })
        except Exception as e: print(f"⚠️ Fout bij heartbeat: {e}")

    full_doc = get_box_full_doc()
    if full_doc and full_doc != cached_config:
        cached_config = full_doc
        print(f"⚙️ Sync voltooid! (Versie: {VERSION})")

    threading.Timer(300, update_pi_status).start()

# --- Hardware & Commando's ---
def turn_light_off():
    global light_timer
    GPIO.output(LIGHT_PIN, GPIO.LOW)
    print("💡 [STATUS] Licht is nu uitgeschakeld.")
    light_timer = None

def close_box(trigger_source="SMS"):
    global light_timer
    print(f"🔒 Box aan het sluiten... (Trigger: {trigger_source})")
    GPIO.output(DOOR_PIN, False)
    
    if light_timer is not None:
        light_timer.cancel()

    hw_config = cached_config.get('hardware', {})
    lighting = hw_config.get('lighting', {})
    delay = lighting.get('lightOffDelaySeconds', 60)
    
    print(f"💡 [STATUS] Licht blijft aan voor {delay} seconden.")
    light_timer = threading.Timer(float(delay), turn_light_off)
    light_timer.start()

def is_authorized(phone_number):
    try:
        is_share = db.collection('boxes').document(DOCUMENT_ID).collection('shares').document(phone_number).get().exists
        is_auth = db.collection('boxes').document(DOCUMENT_ID).collection('authorizedUsers').document(phone_number).get().exists
        return is_share or is_auth
    except Exception as e: return False

def handle_command(doc_ref, data):
    # 1. Geheugencheck (Hebben we dit document al behandeld?)
    if doc_ref.id in processed_commands:
        return

    # 2. Statuscheck
    if data.get('status') != 'pending':
        return 

    # 3. Markering
    processed_commands.add(doc_ref.id) 
    doc_ref.update({'status': 'processing'})
    
    command = data.get('command', '').upper()
    phone = data.get('phone') 
    
    if not is_authorized(phone):
        doc_ref.update({'status': 'denied', 'lastCommandStatus': 'denied'})
        return

    try:
        hw_config = cached_config.get('hardware', {})
        
        if command == "OPEN":
            print(f"🔓 Box openen (ID: {doc_ref.id})...")
            GPIO.output(DOOR_PIN, True)
            
            if hw_config.get('lighting', {}).get('onWhenOpen', True):
                GPIO.output(LIGHT_PIN, GPIO.HIGH)
                
            auto_close = hw_config.get('autoClose', {})
            if auto_close.get('enabled', False):
                delay = auto_close.get('delaySeconds', 60)
                print(f"⏳ AutoClose geactiveerd ({delay}s).")
                threading.Timer(float(delay), lambda: close_box("AutoClose")).start()
            
            doc_ref.update({'status': 'completed', 'lastCommandStatus': 'completed'})
            
        elif command == "CLOSE":
            print(f"🔒 Box sluiten (ID: {doc_ref.id})...")
            close_box(trigger_source="SMS")
            doc_ref.update({'status': 'completed', 'lastCommandStatus': 'completed'})
            
    except Exception as e:
        print(f"❌ Fout bij commando: {e}")
        doc_ref.update({'status': 'error', 'error': str(e)})

# --- Start & Interactieve Console ---
update_pi_status()
print(f"\n👂 Luisterend naar {DOCUMENT_ID} (Versie {VERSION})...")
print("⌨️  Typ 'c' en druk op Enter om de 'Fysieke Sluit-knop' (GPIO 27) te simuleren.")
print("⌨️  Typ 'exit' om te stoppen.")

query = db.collection('boxes').document(DOCUMENT_ID).collection('commands').where(filter=FieldFilter('status', '==', 'pending'))
query_watch = query.on_snapshot(lambda col, chg, read: [handle_command(c.document.reference, c.document.to_dict()) for c in chg if c.type.name in ['ADDED', 'MODIFIED']])

try:
    while True:
        cmd = input("> ")
        if cmd.lower() == 'c':
            physical_close_callback(CLOSE_BTN_PIN)
        elif cmd.lower() == 'exit':
            break
except KeyboardInterrupt:
    print("\n👋 Handmatige stop.")
finally:
    GPIO.cleanup()
    print("🧹 GPIO opgeschoond. Tot ziens!")