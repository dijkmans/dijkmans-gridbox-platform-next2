from google.oauth2 import service_account
from db_manager import get_db, update_box_status
import os

# 1. Pad naar de sleutel (gebaseerd op jouw zoekresultaat)
KEY_PATH = "config/serviceAccountKey.json"

if not os.path.exists(KEY_PATH):
    print(f"FOUT: {KEY_PATH} niet gevonden!")
    # Toon voor de zekerheid de huidige werkmap
    print(f"Huidige map: {os.getcwd()}")
else:
    # 2. Laad de credentials
    creds = service_account.Credentials.from_service_account_file(KEY_PATH)
    
    # 3. Maak verbinding
    db = get_db(creds)
    
    # 4. Stuur een heartbeat voor een test-box
    update_box_status(
        db, 
        box_id="pi-test-001", 
        name="Raspberry Pi Test Unit", 
        status="online"
    )
