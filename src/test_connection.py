from db_manager import get_db

try:
    # Haal de database-client op via onze manager
    db = get_db()
    print("✅ Succes! Verbinding met Firestore via db_manager werkt.")
    
    # Optioneel: Print even de collecties om te zien of hij de data ook echt "ziet"
    collections = [col.id for col in db.collections()]
    print(f"📂 Gevonden collecties in de database: {collections}")

except Exception as e:
    print(f"❌ Oeps, er ging iets mis: {e}")