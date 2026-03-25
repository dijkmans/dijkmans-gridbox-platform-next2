const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const https = require('https');

admin.initializeApp();
const db = admin.firestore();

const BIRD_API_KEY = 'bRoknKEna83EdGVd7wF2VF6ZpAKcP1IXWh4A';
const WORKSPACE_ID = '145d3c27-76ac-4d6a-9e10-1f7dff2f6bcb';
const CHANNEL_ID = 'a703f755-7154-532a-89a0-70103633682e';

function sendSmsViaBird(phoneNumber, messageText) {
    return new Promise((resolve, reject) => {
        let formattedNumber = phoneNumber.replace(/\s+/g, '');
        if (formattedNumber.startsWith('0')) formattedNumber = '+32' + formattedNumber.substring(1);
        else if (formattedNumber.startsWith('4') && formattedNumber.length === 9) formattedNumber = '+32' + formattedNumber;
        else if (!formattedNumber.startsWith('+')) formattedNumber = '+' + formattedNumber;

        const payload = JSON.stringify({
            receiver: { contacts: [{ identifierValue: formattedNumber }] },
            body: { type: 'text', text: { text: messageText } }
        });

        const options = {
            hostname: 'api.bird.com', port: 443,
            path: `/workspaces/${WORKSPACE_ID}/channels/${CHANNEL_ID}/messages`, method: 'POST',
            headers: {
                'Authorization': `AccessKey ${BIRD_API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => res.statusCode >= 200 && res.statusCode < 300 ? resolve(data) : reject(new Error(`Bird API Error (${res.statusCode})`)));
        });
        req.on('error', (e) => reject(e)); req.write(payload); req.end();
    });
}

// 1. LUISTEREN NAAR SHARE
exports.onShareAdded = onDocumentCreated({
    document: 'boxes/{boxId}/shares/{phoneNumber}',
    region: 'europe-west1'
}, async (event) => {
    const data = event.data.data();
    if (!data) return;

    const phoneNumber = event.params.phoneNumber;
    const boxId = event.params.boxId; 
    const boxNr = boxId.split('-')[1] || boxId; 
    const shortBoxNr = parseInt(boxNr, 10).toString(); 
    const name = data.name || 'Gebruiker';

    try {
        const templateSnap = await db.collection('smsTemplates').doc('invitation').get();
        let body = `Beste ${name}, je hebt toegang tot Gridbox ${boxNr}.`; 

        if (templateSnap.exists && templateSnap.data().body) {
            body = templateSnap.data().body
                .replace(/\[customerName\]/g, name)
                .replace(/\[boxNr\]/g, boxNr)           
                .replace(/\[shortBoxNr\]/g, shortBoxNr); 
        }

        await sendSmsViaBird(phoneNumber, body);
        
        // Log als tekst-string (ISO formaat) zodat de frontend het snapt
        await db.collection('boxes').doc(boxId).collection('commands').add({
            command: 'SHARE',
            source: `Uitnodiging naar ${phoneNumber}`,
            status: 'completed',
            createdAt: new Date().toISOString() 
        });

    } catch (e) {
        console.error('Fout bij onShareAdded:', e.message);
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

            await sendSmsViaBird(originator, replyBody);
        }
        res.status(200).send('OK');
    } catch (error) {
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