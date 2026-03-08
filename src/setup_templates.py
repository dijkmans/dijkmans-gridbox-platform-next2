from db_manager import get_db

db = get_db()

templates = {
    "invitation": {
        "body": "Beste [customerName], Gridbox [boxId] is met u gedeeld. Antwoord met 'OPEN [boxId]' om de Gridbox te openen.",
        "variables": ["customerName", "boxId"]
    },
    "confirm_open": {
        "body": "Gridbox [boxId] wordt geopend.",
        "variables": ["boxId"]
    },
    "confirm_close": {
        "body": "Gridbox [boxId] wordt gesloten.",
        "variables": ["boxId"]
    },
    "unauthorized": {
        "body": "Uw GSM heeft geen toegang tot Gridbox [boxId].",
        "variables": ["boxId"]
    },
    "unknown_command": {
        "body": "Onbekend commando. Gebruik OPEN [nummer] of CLOSE [nummer].",
        "variables": []
    },
    "not_reachable": {
        "body": "Gridbox [boxId] is momenteel niet bereikbaar.",
        "variables": ["boxId"]
    }
}

print("🔥 Starten met aanmaken van SMS templates in Firestore...")

for doc_id, data in templates.items():
    db.collection('smsTemplates').document(doc_id).set(data)
    print(f"✅ Template '{doc_id}' opgeslagen.")

print("🚀 Klaar! Je templates staan nu in Firestore.")