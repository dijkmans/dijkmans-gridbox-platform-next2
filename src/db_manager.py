import os
import firebase_admin
from firebase_admin import credentials, firestore

# 1. Bepaal de absolute map waar dit script (db_manager.py) zich bevindt
# Dit werkt altijd, ongeacht vanwaar je het script start.
base_dir = os.path.dirname(os.path.abspath(__file__))

# 2. Construeer het pad: 
# - base_dir is jouw 'src' map.
# - '..' gaat één niveau omhoog naar de project-root.
# - 'config' duikt daarna de configuratiemap in.
key_path = os.path.join(base_dir, '..', 'config', 'serviceAccountKey.json')

def get_db():
    """
    Initialiseert de Firebase app en geeft de database client terug.
    Bevat een extra check om te voorkomen dat pad-fouten voor vage crashes zorgen.
    """
    
    # Check of het bestand echt bestaat op de plek waar we het verwachten
    if not os.path.exists(key_path):
        raise FileNotFoundError(
            f"🚨 Fout: Het bestand 'serviceAccountKey.json' is niet gevonden op dit pad: \n{key_path}\n"
            "Controleer of de map 'config' in de project-root staat en het bestand de juiste naam heeft."
        )

    # Controleer of de app al is geïnitialiseerd (voorkomt 'App already exists' errors)
    # Dit is essentieel als je script in een loop draait.
    if not firebase_admin._apps:
        try:
            # Laad de credentials
            cred = credentials.Certificate(key_path)
            # Initialiseer de app
            firebase_admin.initialize_app(cred)
        except Exception as e:
            print(f"⚠️ Fout bij initialiseren Firebase: {e}")
            raise e

    # Geef de database-client terug
    return firestore.client()