from db_manager import get_db

db = get_db()

def print_db_structure():
    print("\n🔍 Firestore Database Inspectie:\n" + "="*40)
    
    collections = db.collections()
    for col in collections:
        print(f"\n📁 Collectie: {col.id}")
        docs = col.stream()
        for doc in docs:
            print(f"  📄 Document: {doc.id}")
            data = doc.to_dict()
            for key, value in data.items():
                print(f"     - {key}: {value}")

if __name__ == "__main__":
    try:
        print_db_structure()
    except Exception as e:
        print(f"⚠️ Fout bij inspectie: {e}")