const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// CONFIGURATIE: API gegevens bovenaan voor centraal beheer
const BIRD_API_KEY = 'bRoknKEna83EdGVd7wF2VF6ZpAKcP1IXWh4A';
const BIRD_URL = `https://api.bird.com/workspaces/145d3c27-76ac-4d6a-9e10-1f7dff2f6bcb/channels/a703f755-7154-532a-89a0-70103633682e/messages`;

// Slimme functie om tekst in te vullen
function fillTemplate(text, data) {
    let result = text;
    result = result.replace(/\[customerName\]/g, data.customerName || "onze klant");
    result = result.replace(/\[boxNr\]/g, data.boxNr || "");
    result = result.replace(/\[location\]/g, data.location || "onze locatie");
    return result;
}

// Hulpmiddel om SMS te versturen via Bird
async function sendSms(to, text) {
    return fetch(BIRD_URL, {
        method: 'POST',
        headers: { 
            'Authorization': `AccessKey ${BIRD_API_KEY}`, 
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
            receiver: { contacts: [{ identifierValue: to }] },
            body: { type: 'text', text: { text: text } }
        })
    });
}

// 1. UITNODIGING VERSTUREN (createShare)
exports.createShare = onCall({ region: 'europe-west1', cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Je moet ingelogd zijn.');
    
    let { boxId, phoneNumber, name: inviteeName } = request.data;
    
    if (!phoneNumber) throw new HttpsError('invalid-argument', 'Telefoonnummer ontbreekt.');

    // Telefoonnummer opschonen
    phoneNumber = phoneNumber.replace(/\s+/g, '');
    if (phoneNumber.startsWith('0')) phoneNumber = '+32' + phoneNumber.substring(1);
    if (!phoneNumber.startsWith('+')) phoneNumber = '+' + phoneNumber;

    try {
        // A. Haal Box data op
        const boxDoc = await db.collection('boxes').doc(boxId).get();
        if (!boxDoc.exists) throw new Error('Box niet gevonden');
        const boxData = boxDoc.data();

        // B. Haal de echte Klantnaam op
        let customerDisplayName = "onze klant";
        if (boxData.customerId) {
            const custDoc = await db.collection('customers').doc(boxData.customerId).get();
            if (custDoc.exists) customerDisplayName = custDoc.data().name;
        }

        // C. Haal de Locatienaam op
        let locationDisplayName = "onze locatie";
        if (boxData.siteId) {
            const siteDoc = await db.collection('sites').doc(boxData.siteId).get();
            if (siteDoc.exists) locationDisplayName = siteDoc.data().name;
        }

        // D. Haal de Template op
        const tempDoc = await db.collection('smsTemplates').doc('invitation').get();
        let bodyText = tempDoc.exists ? tempDoc.data().body : "Beste [customerName], je hebt toegang tot Gridbox [boxNr].";

        // E. Vul de template in
        const finalSmsText = fillTemplate(bodyText, {
            customerName: customerDisplayName,
            boxNr: parseInt(boxId.split('-')[1], 10),
            location: locationDisplayName
        });

        // F. Verstuur via Bird
        await sendSms(phoneNumber, finalSmsText);

        // G. Sla de share op in de box
        await db.collection('boxes').doc(boxId).collection('shares').doc(phoneNumber).set({
            name: inviteeName,
            status: 'sent',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { 
            success: true, 
            message: `Gelukt! SMS verstuurd naar ${phoneNumber}.` 
        };

    } catch (e) {
        console.error("SMS Error:", e);
        throw new HttpsError('internal', e.message);
    }
});

// 2. INKOMENDE SMS (smsHandler)
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
                const action = msg.includes('CLOSE') ? 'CLOSE' : 'OPEN';
                
                // A. Voer het commando uit in Firestore (voor de fysieke Gridbox)
                await db.collection('boxes').doc(boxId).collection('commands').add({
                    command: action,
                    status: 'pending',
                    requestedBy: 'SMS:' + originator,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });

                // B. STUUR BEVESTIGING TERUG NAAR DE GEBRUIKER
                const replyText = `Gridbox ${boxNr} wordt nu voor u ${action === 'OPEN' ? 'geopend' : 'gesloten'}.`;
                await sendSms(originator, replyText);
            }
        }
        res.status(200).send('OK');
    } catch (error) { 
        console.error("Inkomende SMS Fout:", error);
        res.status(500).send('Error'); 
    }
});