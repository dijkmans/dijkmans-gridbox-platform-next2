from google.cloud import firestore
import datetime

def get_db(creds):
    """Initialiseert de Firestore client met de meegeleverde credentials."""
    return firestore.Client(credentials=creds)

def update_box_status(db, box_id, name, status):
    """Updates of maakt een gridbox aan in de "boxes" collectie."""
    doc_ref = db.collection("boxes").document(box_id)
    doc_ref.set({
        "name": name,
        "status": status,
        "last_seen": datetime.datetime.now(datetime.timezone.utc)
    }, merge=True)
    print(f"Status voor {name} bijgewerkt naar {status}.")
