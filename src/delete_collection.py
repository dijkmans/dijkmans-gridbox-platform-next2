from db_manager import get_db

# 1. Verbind met de database
db = get_db()

def delete_collection(coll_ref, batch_size=500):
    """
    Verwijdert documenten in kleine batches (pakketjes) van 500.
    Dit voorkomt dat Firestore overbelast raakt bij grote collecties.
    """
    docs = coll_ref.limit(batch_size).stream()
    deleted = 0

    for doc in docs:
        doc.reference.delete()
        deleted += 1

    # Als we de batch-limiet hebben bereikt, roepen we onszelf opnieuw aan
    if deleted >= batch_size:
        return deleted + delete_collection(coll_ref, batch_size)
    
    return deleted

# ==========================================
# CONFIGURATIE
# Pas hier aan welke collectie je wilt legen
# ==========================================
target_collection = 'shares' 

# 2. Start de operatie
print(f"🔥 Starten met het verwijderen van collectie: '{target_collection}'...")

coll_ref = db.collection(target_collection)
deleted_count = delete_collection(coll_ref)

print(f"✅ Klaar! Er zijn in totaal {deleted_count} documenten verwijderd uit '{target_collection}'.")