from db_manager import get_db
from google.oauth2 import service_account
from datetime import datetime
from zoneinfo import ZoneInfo

KEY_PATH = r"..\config\serviceAccountKey.json"
TARGET_VERSION = "v1.0.64"
TIMEZONE = ZoneInfo("Europe/Brussels")

creds = service_account.Credentials.from_service_account_file(KEY_PATH)
db = get_db(creds)

now_iso = datetime.now(TIMEZONE).isoformat()
boxes = list(db.collection("boxes").stream())

updated = 0
for doc in boxes:
    doc.reference.set({
        "software": {
            "targetVersion": TARGET_VERSION,
            "softwareUpdateRequested": True
        },
        "updatedAt": now_iso,
        "updatedBy": "local-rollout-v1.0.64"
    }, merge=True)
    print(f"  updated: {doc.id}")
    updated += 1

print(f"\nKlaar. {updated} box(en) bijgewerkt naar {TARGET_VERSION} met softwareUpdateRequested=true.")
