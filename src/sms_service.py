import requests
import os
from dotenv import load_dotenv
load_dotenv()
from db_manager import get_db

db = get_db()

# Vul hier je echte MessageBird/Bird API sleutel in
API_KEY = os.environ.get("BIRD_API_KEY", "")
ORIGINATOR = "GridBox"  # De naam die de klant ziet als afzender

def send_sms(phone_number, template_id, box_id, customer_name="Klant"):
    """
    Verstuurt een SMS op basis van een template uit Firestore.
    """
    try:
        # 1. Haal de template op uit Firestore
        template_doc = db.collection('smsTemplates').document(template_id).get()
        
        if not template_doc.exists:
            print(f"âš ï¸ Fout: Template '{template_id}' niet gevonden in database!")
            return False
            
        # 2. Haal de tekst en vervang de variabelen
        message = template_doc.get('body')
        message = message.replace("[boxId]", str(box_id))
        message = message.replace("[customerName]", customer_name)

        # 3. Verstuur de SMS via MessageBird
        url = "https://rest.messagebird.com/messages"
        headers = {
            "Authorization": f"AccessKey {API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "recipients": [phone_number],
            "originator": ORIGINATOR,
            "body": message
        }
        
        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code == 201:
            print(f"âœ… SMS '{template_id}' naar {phone_number} verzonden.")
            return True
        else:
            print(f"âš ï¸ SMS fout ({response.status_code}): {response.text}")
            return False

    except Exception as e:
        print(f"âŒ SMS netwerkfout: {e}")
        return False
