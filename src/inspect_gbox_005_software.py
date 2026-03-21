from db_manager import get_db
from google.oauth2 import service_account
import json

KEY_PATH = r"config\serviceAccountKey.json"
BOX_ID = "gbox-005"

creds = service_account.Credentials.from_service_account_file(KEY_PATH)
db = get_db(creds)

doc = db.collection("boxes").document(BOX_ID).get()

if not doc.exists:
    print("BOX_NOT_FOUND")
    raise SystemExit(1)

data = doc.to_dict() or {}
software = data.get("software", {})

print(json.dumps({
    "boxId": BOX_ID,
    "software": software
}, indent=2, ensure_ascii=False))