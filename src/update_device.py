from db_manager import get_db
import datetime

db = get_db()

# We updaten document 'gbox-001' in de collectie 'devices'
device_ref = db.collection('devices').document('gbox-001')

# We voegen een 'lastCheckin' veld toe (of werken het bij)
try:
    device_ref.update({
        'lastCheckin': datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        'status': 'online'
    })
    print("🚀 Apparaat 'gbox-001' is succesvol bijgewerkt!")
except Exception as e:
    print(f"❌ Oeps, er ging iets mis: {e}")