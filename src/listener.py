from db_manager import get_db
from google.cloud import firestore
from firebase_admin import storage
from datetime import datetime, timedelta, timezone
import platform
import threading
import time
import os
import shutil
import requests

# --- CONFIGURATIE ---
DOCUMENT_ID = "gbox-001"
BUCKET_NAME = "gridbox-platform.firebasestorage.app"

# --- Hardware Setup ---
if platform.system() == "Windows":
    print("🖥️ Windows gedetecteerd: Hardware-acties worden gesimuleerd.")
    class MockGPIO:
        BCM = "BCM"; OUT = "OUT"; HIGH = True; LOW = False
        def setmode(self, mode): pass
        def setup(self, pin, mode): pass
        def output(self, pin, state): print(f"  [SIMULATIE] GPIO pin {pin} is nu {'HIGH' if state else 'LOW'}")
        def cleanup(self): pass
    GPIO = MockGPIO()
else:
    import RPi.GPIO as GPIO

# Configuratie pinnen
DOOR_PIN = 17
LIGHT_PIN = 22
GPIO.setmode(GPIO.BCM)
GPIO.setup(DOOR_PIN, GPIO.OUT)
GPIO.setup(LIGHT_PIN, GPIO.OUT)

db = get_db()

# --- Globale variabelen ---
auto_close_timer = None
camera_monitoring_active = False

# --- Camera Functie ---
def capture_snapshot():
    """Haalt snapshot op met authenticatie en upload naar specifieke Firebase Storage bucket."""
    config = get_hardware_config().get('camera', {})
    if not config.get('enabled', False): return None
    
    # URL en inloggegevens uit de Firestore config
    camera_url = config.get('snapshotUrl', 'http://192.168.10.100/cgi-bin/snapshot.cgi')
    username = config.get('username', '')
    password = config.get('password', '')
    
    try:
        # Authenticatie toevoegen
        response = requests.get(camera_url, auth=(username, password), timeout=5)
        
        if response.status_code == 200:
            filename = f"snapshots/{DOCUMENT_ID}_{int(time.time())}.jpg"
            # Hier gebruiken we de bucket-naam specifiek
            bucket = storage.bucket(BUCKET_NAME)
            blob = bucket.blob(filename)
            blob.upload_from_string(response.content, content_type='image/jpeg')
            blob.make_public()
            return blob.public_url
        else:
            print(f"⚠️ Camera fout: Status code {response.status_code}")
    except Exception as e:
        print(f"⚠️ Camera fout: {e}")
    return None

def camera_loop():
    """Thread: Blijft foto's maken zolang camera_monitoring_active True is."""
    global camera_monitoring_active
    print("🎥 Camera monitoring gestart.")
    while camera_monitoring_active:
        capture_snapshot()
        config = get_hardware_config().get('camera', {})
        interval = config.get('snapshotIntervalSeconds', 3)
        time.sleep(interval)
    print("🎥 Camera monitoring gestopt.")

# --- Audit Logging & Status ---
def log_audit(phone, command, success, message=""):
    try:
        config = get_hardware_config()
        retention_days = config.get('auditLogRetentionDays', 30)
        expiry_date = datetime.now(timezone.utc) + timedelta(days=retention_days)
        
        log_data = {
            "phone": phone, "command": command, "success": success,
            "message": message, "timestamp": firestore.SERVER_TIMESTAMP,
            "expiresAt": expiry_date, "deviceId": DOCUMENT_ID
        }
        db.collection('auditLogs').add(log_data)
        print(f"📝 Audit log opgeslagen: {message}")
    except Exception as e:
        print(f"⚠️ Fout bij schrijven audit log: {e}")

def get_diagnostics():
    if platform.system() == "Windows": return {"diskFreeGB": 99.9, "uptimeDays": 0.1, "cpuLoad": 1.2}
    try:
        total, used, free = shutil.disk_usage("/")
        disk_free_gb = round(free / (2**30), 2)
        with open('/proc/uptime', 'r') as f:
            uptime_seconds = float(f.readline().split()[0])
        return {"diskFreeGB": disk_free_gb, "uptimeDays": round(uptime_seconds / 86400, 1), "cpuLoad": round(os.getloadavg()[0], 2)}
    except Exception: return {"error": "diag_failed"}

def get_cpu_temperature():
    try:
        if platform.system() != "Windows":
            with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
                return round(float(f.read()) / 1000.0, 1)
        return 45.0
    except Exception: return 0.0

def update_pi_status():
    temp = get_cpu_temperature()
    diag = get_diagnostics()
    try:
        db.collection('boxes').document(DOCUMENT_ID).update({
            'status.temperature': temp,
            'status.lastHeartbeat': time.time(),
            'status.diagnostics': diag
        })
    except Exception as e: print(f"⚠️ Fout bij status update: {e}")
    threading.Timer(300, update_pi_status).start()

# --- Hardware & Configuratie ---
def get_hardware_config():
    try:
        doc = db.collection('boxes').document(DOCUMENT_ID).get()
        if doc.exists: return doc.to_dict().get('hardware', {})
    except Exception as e: print(f"⚠️ Fout bij ophalen config: {e}")
    return {}

def is_authorized(phone_number):
    try:
        return db.collection('boxes').document(DOCUMENT_ID).collection('authorizedUsers').document(phone_number).get().exists
    except Exception: return False

def auto_close_task():
    global camera_monitoring_active
    print("⏳ Auto-close tijd verstreken: Sluiten...")
    camera_monitoring_active = False 
    GPIO.output(DOOR_PIN, False)
    threading.Timer(30, lambda: GPIO.output(LIGHT_PIN, GPIO.LOW)).start()

# --- Commando Afhandeling ---
def handle_command(doc_ref, data):
    global auto_close_timer, camera_monitoring_active
    command = data.get('command', '').upper()
    phone = data.get('phone') 
    
    if not is_authorized(phone):
        log_audit(phone, command, False, "Unauthorized access attempt")
        doc_ref.update({'status': 'denied'})
        return

    config = get_hardware_config()
    try:
        if command == "OPEN":
            if not camera_monitoring_active:
                camera_monitoring_active = True
                threading.Thread(target=camera_loop, daemon=True).start()
            
            GPIO.output(DOOR_PIN, True)
            if config.get('lighting', {}).get('onWhenOpen', True): GPIO.output(LIGHT_PIN, GPIO.HIGH)
            
            auto_close = config.get('autoClose', {})
            if auto_close.get('enabled', False):
                if auto_close_timer: auto_close_timer.cancel()
                auto_close_timer = threading.Timer(auto_close.get('delayMs', 60000)/1000, auto_close_task)
                auto_close_timer.start()
            
            msg = "Command executed successfully"
            log_audit(phone, command, True, msg)
            
        elif command == "CLOSE":
            camera_monitoring_active = False
            if auto_close_timer: auto_close_timer.cancel()
            GPIO.output(DOOR_PIN, False)
            GPIO.output(LIGHT_PIN, GPIO.LOW)
            log_audit(phone, command, True, "Command executed successfully")
            
        elif command == "SNAPSHOT":
            link = capture_snapshot()
            log_audit(phone, "SNAPSHOT", True, f"Gedwongen foto: {link}")

        doc_ref.update({'status': 'completed'})
    except Exception as e:
        log_audit(phone, command, False, str(e))
        doc_ref.update({'status': 'error', 'error': str(e)})

# --- Start ---
update_pi_status()
print("👂 Luisterend naar commando's...")
query_watch = db.collection('boxCommands').on_snapshot(lambda col, chg, read: [handle_command(c.document.reference, c.document.to_dict()) for c in chg if c.type.name in ['ADDED', 'MODIFIED'] and c.document.to_dict().get('status') == 'pending'])

try: input()
except KeyboardInterrupt:
    GPIO.cleanup()
    print("\n👋 Luisteraar gestopt.")