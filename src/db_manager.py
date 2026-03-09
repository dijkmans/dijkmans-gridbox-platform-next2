from google.cloud import firestore

def get_db(creds):
    # Deze functie accepteert nu de 'creds' (credentials) die we meesturen
    return firestore.Client(credentials=creds)