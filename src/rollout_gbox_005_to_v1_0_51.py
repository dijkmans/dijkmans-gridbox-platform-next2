from db_manager import get_db
from google.oauth2 import service_account
from datetime import datetime
from zoneinfo import ZoneInfo
import json

KEY_PATH = r"config\serviceAccountKey.json"
BOX_ID = "gbox-005"
TARGET_VERSION = "v1.0.51"
TIMEZONE = ZoneInfo("Europe/Brussels")

creds = service_account.Credentials.from_service_account_file(KEY_PATH)
db = get_db(creds)

doc_ref = db.collection("boxes").document(BOX_ID)
now_iso = datetime.now(TIMEZONE).isoformat()

doc_ref.set({
    "software": {
        "targetVersion": TARGET_VERSION,
        "softwareUpdateRequested": True,
        "lastError": None,
        "lastUpdateAttemptAt": now_iso
    },
    "updatedAt": now_iso,
    "updatedBy": "local-rollout-script"
}, merge=True)

software = (doc_ref.get().to_dict() or {}).get("software", {})

print(json.dumps({
    "boxId": BOX_ID,
    "targetVersion": software.get("targetVersion"),
    "versionRaspberry": software.get("versionRaspberry"),
    "softwareUpdateRequested": software.get("softwareUpdateRequested"),
    "updateStatus": software.get("updateStatus"),
    "deploymentStatus": software.get("deploymentStatus")
}, indent=2, ensure_ascii=False))