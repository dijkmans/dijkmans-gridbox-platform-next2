const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// 1. UITGAANDE SMS (Voor Uitnodigingen)
exports.createShare = onCall({ region: 'europe-west1', cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Log in verplicht.');
    
    let { boxId, phoneNumber, name } = request.data;
    phoneNumber = phoneNumber.replace(/\s+/g, '');
    if (phoneNumber.startsWith('0')) phoneNumber = '+32' + phoneNumber.substring(1);
    if (!phoneNumber.startsWith('+')) phoneNumber = '+' + phoneNumber;

    const shareRef = db.collection('boxes').doc(boxId).collection('shares').doc(phoneNumber);

    try {
        await shareRef.set({ name, active: true, status: 'sending', createdAt: admin.firestore.FieldValue.serverTimestamp() });

        let body = `Beste ${name}, je hebt toegang tot Gridbox ${boxId}. \n\nStuur "Open ${boxId.split('-')[1]}" naar +32480214031 om de box te openen.`;

        const WORKSPACE_ID = '145d3c27-76ac-4d6a-9e10-1f7dff2f6bcb';
        const CHANNEL_ID = 'a703f755-7154-532a-89a0-70103633682e';
        const API_KEY = 'bRoknKEna83EdGVd7wF2VF6ZpAKcP1IXWh4A'; // Vervangen we hieronder

        const payload = {
            receiver: { contacts: [{ identifierValue: phoneNumber }] },
            body: { type: 'text', text: { text: body } }
        };

        const response = await fetch(`https://api.bird.com/workspaces/${WORKSPACE_ID}/channels/${CHANNEL_ID}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `AccessKey ${API_KEY}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.text();
            await shareRef.update({ status: 'failed', error: errorData });
            return { success: false, message: 'SMS mislukt' };
        }

        const responseData = await response.json();
        await shareRef.update({ status: 'sent', birdId: responseData.id || 'sent', error: null });
        return { success: true, message: 'SMS succesvol verzonden!' };

    } catch (e) {
        await shareRef.update({ status: 'error', error: e.message });
        throw new HttpsError('internal', e.message);
    }
});

// 2. OPEN BOX (Web Portaal)
exports.openBox = onCall({ region: 'europe-west1', cors: true }, async (request) => {
    const { boxId } = request.data;
    await db.collection('boxes').doc(boxId).collection('commands').add({
        command: 'OPEN', status: 'pending', requestedBy: request.auth.token.email, createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, message: `Sleutel omgedraaid voor ${boxId}` };
});

// 3. INKOMENDE SMS HANDLER (Nu MET een SMS terug!)
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
                
                // A. Laat het relais klikken
                await db.collection('boxes').doc(boxId).collection('commands').add({
                    command: msg.includes('CLOSE') ? 'CLOSE' : 'OPEN',
                    status: 'pending',
                    requestedBy: 'SMS:' + originator,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });

                // B. Stuur de bevestiging ("Gridbox 5 wordt geopend.") terug
                const actionText = msg.includes('CLOSE') ? 'gesloten' : 'geopend';
                const replyBody = `Gridbox ${boxNr} wordt ${actionText}.`;
                
                const WORKSPACE_ID = '145d3c27-76ac-4d6a-9e10-1f7dff2f6bcb';
                const CHANNEL_ID = 'a703f755-7154-532a-89a0-70103633682e';
                const API_KEY = 'bRoknKEna83EdGVd7wF2VF6ZpAKcP1IXWh4A'; // Zelfde sleutel

                const apiPayload = {
                    receiver: { contacts: [{ identifierValue: originator }] },
                    body: { type: 'text', text: { text: replyBody } }
                };

                await fetch(`https://api.bird.com/workspaces/${WORKSPACE_ID}/channels/${CHANNEL_ID}/messages`, {
                    method: 'POST',
                    headers: { 'Authorization': `AccessKey ${API_KEY}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(apiPayload)
                });
            }
        }
        res.status(200).send('OK');
    } catch (error) {
        console.error("Fout in smsHandler:", error);
        res.status(500).send('Error');
    }
});

exports.inviteUser = onCall({ region: 'europe-west1', cors: true }, async (request) => {
    await db.collection('users').add({ email: request.data.email, role: 'user', status: 'invited', createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return { success: true };
});
