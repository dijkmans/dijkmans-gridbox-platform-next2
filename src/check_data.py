import firebase_admin
from firebase_admin import credentials, firestore
import os

# Pad naar je sleutel
key_path = os.path.join("config", "serviceAccountKey.json")

# Initialiseer verbinding
cred = credentials.Certificate(key_path)
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

db = firestore.client()

# Haal de namen van alle collecties op
print("🔍 De database bevat de volgende collecties:")
collections = db.collections()
for col in collections:
    print(f"- {col.id}")

print("\nKlaar met inspecteren.")