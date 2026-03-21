import json
import os
from google.oauth2 import service_account
from google.cloud import firestore

# We gebruiken nu het pad dat we zojuist gevonden hebben
key_path = "../config/serviceAccountKey.json"

if not os.path.exists(key_path):
    print(f"❌ Fout: Kan {key_path} niet vinden.")
    exit()

try:
    print(f"Sleutel gevonden in config map!")
    creds = service_account.Credentials.from_service_account_file(key_path)
    db = firestore.Client(credentials=creds)

    print("Bezig met ophalen van alle box-gegevens...")
    boxes_ref = db.collection("boxes").stream()
    
    data = {}
    for doc in boxes_ref:
        data[doc.id] = doc.to_dict()

    with open("database_export.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, default=str)

    print("\n✅ HOEZEE! Het bestand 'database_export.json' is nu echt aangemaakt.")
    print("Je kunt dit bestand nu naar Gemini uploaden.")
except Exception as e:
    print(f"\n❌ Er ging iets mis: {e}")
