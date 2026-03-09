from db_manager import get_db
from google.cloud import firestore

db = get_db()

def clean_orphan_temperature():
    print("🧹 Begin met opschonen van 'temperature' velden...")
    boxes = db.collection('boxes').stream()
    
    count = 0
    for doc in boxes:
        data = doc.to_dict()
        # We kijken of er een 'temperature' veld is in de 'root' van het document
        # (Dus niet in de map 'status' of 'diagnostics')
        if 'temperature' in data:
            print(f"📦 Box {doc.id} gevonden: 'temperature' veld verwijderen.")
            # Verwijder alleen het veld, niet de rest van het document
            doc.reference.update({'temperature': firestore.DELETE_FIELD})
            count += 1
        else:
            print(f"📦 Box {doc.id}: Geen verouderde data gevonden.")

    print(f"✅ Klaar! Er zijn {count} documenten opgeschoond.")

if __name__ == "__main__":
    clean_orphan_temperature()