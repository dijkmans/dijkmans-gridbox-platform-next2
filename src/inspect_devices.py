from db_manager import get_db

db = get_db()

# We kijken in de 'devices' collectie
print("🔍 Documenten in 'devices' collectie:")
docs = db.collection('devices').stream()

for doc in docs:
    print(f"📄 Document ID: {doc.id}")
    print(f"   Data: {doc.to_dict()}")