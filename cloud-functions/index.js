const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// 1. LUISTEREN NAAR SHARE (De "Waakhond" voor Staged Delivery)
exports.onShareStatusChanged = onDocumentWritten({
    document: 'boxes/{boxId}/shares/{phoneNumber}',
    region: 'europe-west1'
}, async (event) => {
    const beforeData = event.data.before && event.data.before.exists ? event.data.before.data() : null;
    const afterData = event.data.after && event.data.after.exists ? event.data.after.data() : null;

    // Als het document verwijderd is (prullenbak icoon), doe niets
    if (!afterData) return;

    // Controleer of de share hiervoor al actief was, en of hij nu actief is
    const wasActive = beforeData ? (beforeData.active === true || beforeData.status === 'active') : false;
    const isNowActive = afterData.active === true || afterData.status === 'active';

    // LOGISTIEKE REGEL:
    // We sturen ALLEEN een SMS als de share voorheen NIET actief was, en NU WEL actief is.
    // Is hij nog "pending" (Klaarzetten)? Dan blijft de code hier stilstaan.
    if (wasActive || !isNowActive) {
        console.log(`[TRIGGER] SMS genegeerd. wasActive: ${wasActive}, isNowActive: ${isNowActive}`);
        return;
    }

    let phoneNumber = event.params.phoneNumber;
    const boxId = event.params.boxId; 
    const boxNr = boxId.split('-')[1] || boxId; 
    const shortBoxNr = parseInt(boxNr, 10).toString(); 
    const name = afterData.name || 'Gebruiker';

    try {
        const templateSnap = await db.collection('smsTemplates').doc('invitation').get();
        let body = `Beste ${name}, je hebt toegang tot Gridbox ${boxNr}.`; 

        if (templateSnap.exists && templateSnap.data().body) {
            body = templateSnap.data().body
                .replace(/\[customerName\]/g, name)
                .replace(/\[boxNr\]/g, boxNr)            
                .replace(/\[shortBoxNr\]/g, shortBoxNr); 
        }

        // Formatteer telefoonnummer (exact zoals in je originele code)
        phoneNumber = phoneNumber.replace(/\s+/g, '');
        if (phoneNumber.startsWith('0')) phoneNumber = '+32' + phoneNumber.substring(1);
        if (!phoneNumber.startsWith('+')) phoneNumber = '+' + phoneNumber;

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
            const errorData = await response.text();
            console.error('Fout bij versturen via Bird API:', errorData);
        } else {
            console.log(`Succesvol SMS verstuurd naar ${phoneNumber}`);
        }
        
        // Log als tekst-string (ISO formaat) zodat de frontend het snapt
        await db.collection('boxes').doc(boxId).collection('commands').add({
            command: 'SHARE',
            source: `Uitnodiging naar ${phoneNumber}`,
            status: 'completed',
            createdAt: new Date().toISOString() 
        });

    } catch (e) {
        console.error('Fout bij onShareStatusChanged:', e.message);
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

        const boxNrMatch = msg.match(/\d+/); 
        
        if (boxNrMatch) {
            const boxNr = boxNrMatch[0];
            const shortBoxNr = parseInt(boxNr, 10).toString();
            const boxId = 'gbox-' + boxNr.padStart(3, '0');
            
            let action = 'UNKNOWN';
            if (msg.includes('OPEN')) action = 'OPEN';
            else if (msg.includes('CLOSE')) action = 'CLOSE';

            // Log als tekst-string (ISO formaat) zodat de frontend het snapt
            await db.collection('boxes').doc(boxId).collection('commands').add({
                command: action,
                source: `SMS van ${originator} ("${messageText}")`,
                status: action === 'UNKNOWN' ? 'completed' : 'pending',
                createdAt: new Date().toISOString()
            });

            let templateName = 'confirm_open';
            if (action === 'CLOSE') templateName = 'confirm_close';
            if (action === 'UNKNOWN') templateName = 'unknown_command';

            const templateSnap = await db.collection('smsTemplates').doc(templateName).get();
            let replyBody = `Actie geregistreerd voor Gridbox ${shortBoxNr}.`; 
            
            if (templateSnap.exists && templateSnap.data().body) {
                replyBody = templateSnap.data().body
                    .replace(/\[boxId\]/g, boxNr)
                    .replace(/\[boxNr\]/g, boxNr)
                    .replace(/\[shortBoxNr\]/g, shortBoxNr);
            }

            // Bird API integratie (Inline, zonder onnodige helpers, exact zoals origineel)
            const WORKSPACE_ID = '145d3c27-76ac-4d6a-9e10-1f7dff2f6bcb';
            const CHANNEL_ID = 'a703f755-7154-532a-89a0-70103633682e';
            const API_KEY = 'bRoknKEna83EdGVd7wF2VF6ZpAKcP1IXWh4A';

            const apiPayload = {
                receiver: { contacts: [{ identifierValue: originator }] },
                body: { type: 'text', text: { text: replyBody } }
            };

            await fetch(`https://api.bird.com/workspaces/${WORKSPACE_ID}/channels/${CHANNEL_ID}/messages`, {
                method: 'POST',
                headers: { 
                    'Authorization': `AccessKey ${API_KEY}`, 
                    'Content-Type': 'application/json', 
                    'Accept': 'application/json' 
                },
                body: JSON.stringify(apiPayload)
            });
        }
        res.status(200).send('OK');
    } catch (error) {
        console.error("Fout in smsHandler:", error);
        res.status(500).send('Error');
    }
});

// 3. OVERIGE FUNCTIES
exports.openBox = onCall({ region: 'europe-west1', cors: true }, async (request) => {
    const { boxId } = request.data;
    await db.collection('boxes').doc(boxId).collection('commands').add({ 
        command: 'OPEN', 
        source: 'Web Dashboard', 
        status: 'pending', 
        createdAt: new Date().toISOString() 
    });
    return { success: true };
});

exports.inviteUser = onCall({ region: 'europe-west1', cors: true }, async (request) => {
    await db.collection('users').add({ email: request.data.email, role: 'user', status: 'invited', createdAt: new Date().toISOString() });
    return { success: true };
});