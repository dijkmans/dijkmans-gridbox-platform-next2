const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// 1. AUTOMATISCHE SMS VERZENDEN (Nu met de juiste vierkante haken!)
exports.onShareAdded = onDocumentCreated({
    document: 'boxes/{boxId}/shares/{phoneNumber}',
    region: 'europe-west1'
}, async (event) => {
    const data = event.data.data();
    const phoneNumber = event.params.phoneNumber;
    const boxId = event.params.boxId;
    const name = data.name || 'Gebruiker';
    
    // We berekenen het boxNr (bijv. "005" uit "gbox-005")
    const boxNr = boxId.split('-')[1] || '';

    try {
        console.log(`Versturen van SMS naar ${phoneNumber} voor box ${boxId}`);

        let body = '';
        
        // Haal de template op uit Firestore
        const settingsDoc = await db.collection('settings').doc('sms').get();
        
        if (settingsDoc.exists && settingsDoc.data().invite_message) {
            let template = settingsDoc.data().invite_message;
            
            // Vervang JOUW specifieke labels ([customerName] en [boxNr])
            body = template
                .replace(/\[customerName\]/g, name)
                .replace(/\[boxNr\]/g, boxNr);
                
            console.log('Template succesvol geladen en ingevuld:', body);
        } else {
            // Fallback
            console.log('Geen template gevonden, we gebruiken de standaard tekst.');
            body = `Beste ${name}, je hebt toegang tot Gridbox ${boxId}. \n\nStuur 'Open ${boxNr}' naar +32480214031 om de box te openen.`;
        }

        const WORKSPACE_ID = '145d3c27-76ac-4d6a-9e10-1f7dff2f6bcb';
        const CHANNEL_ID = 'a703f755-7154-532a-89a0-70103633682e';
        const API_KEY = 'bRoknKEna83EdGVd7wF2VF6ZpAKcP1IXWh4A';

        const payload = {
            receiver: { contacts: [{ identifierValue: phoneNumber }] },
            body: { type: 'text', text: { text: body } }
        };

        const response = await fetch(`https://api.bird.com/workspaces/${WORKSPACE_ID}/channels/${CHANNEL_ID}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `AccessKey ${API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Bird API fout:', errorText);
            return;
        }
        console.log('SMS succesvol verzonden via Bird!');
    } catch (e) {
        console.error('Fout bij versturen SMS:', e.message);
    }
});

// 2. INKOMENDE SMS HANDLER
exports.smsHandler = onRequest({ region: 'europe-west1' }, async (req, res) => {
    try {
        const payload = req.body?.payload;
        if (!payload) return res.status(200).send('OK');

        const messageText = payload.lastMessage?.preview?.text || "";
        const originator = payload.lastMessage?.sender?.contact?.identifierValue || "Onbekend";
        const msg = messageText.toUpperCase();

        if (msg.includes('OPEN') || msg.includes('CLOSE')) {
            const boxNr = msg.replace(/[^0-9]/g, '');
            if (boxNr) {
                const boxId = 'gbox-' + boxNr.padStart(3, '0');
                await db.collection('boxes').doc(boxId).collection('commands').add({
                    command: msg.includes('CLOSE') ? 'CLOSE' : 'OPEN',
                    status: 'pending',
                    requestedBy: 'SMS:' + originator,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        }
        res.status(200).send('OK');
    } catch (error) {
        res.status(500).send('Error');
    }
});
