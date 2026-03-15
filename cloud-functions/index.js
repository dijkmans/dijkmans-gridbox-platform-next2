const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const mb = require('messagebird').initClient('NzCP9BR7gRtERq0KCYi6DbPaZ3ZkwAxsmjS6');

admin.initializeApp();
const db = admin.firestore();

// A. DEEL-FUNCTIE (Dashboard -> SMS Uitnodiging)
exports.createShare = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Log in verplicht.');
    let { boxId, phoneNumber, name } = request.data;
    phoneNumber = phoneNumber.replace(/\s+/g, '');
    if (phoneNumber.startsWith('0')) phoneNumber = '+32' + phoneNumber.substring(1);
    if (!phoneNumber.startsWith('+')) phoneNumber = '+' + phoneNumber;

    try {
        const shareRef = db.collection('boxes').doc(boxId).collection('shares').doc(phoneNumber);
        await shareRef.set({ name, active: true, status: 'pending', createdAt: admin.firestore.FieldValue.serverTimestamp() });
        const template = await db.collection('smsTemplates').doc('invitation').get();
        let body = template.exists ? template.data().body : 'Beste [customerName], welkom bij Gridbox [boxId].';
        body = body.replace('[customerName]', name).replace('[boxId]', boxId);
        body += '\n\nStuur "Open ' + parseInt(boxId.split('-')[1]) + '" om te openen.';
        return new Promise((res) => {
            mb.messages.create({ originator: 'Gridbox', recipients: [phoneNumber], body }, async (err) => {
                if (err) { await shareRef.update({ status: 'failed' }); res({ success: false, message: 'SMS mislukt' }); }
                else { await shareRef.update({ status: 'sent' }); res({ success: true, message: 'SMS verzonden naar ' + name }); }
            });
        });
    } catch (e) { throw new HttpsError('internal', e.message); }
});

// B. HANDMATIG OPENEN (Dashboard Knop)
exports.openBox = onCall({ cors: true }, async (request) => {
    const { boxId, action } = request.data;
    const cmd = (action === 'CLOSE') ? 'CLOSE' : 'OPEN';
    await db.collection('boxes').doc(boxId).collection('commands').add({
        command: cmd, status: 'pending', requestedBy: request.auth.token.email, createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('auditLogs').add({ boxId, action: cmd, userEmail: request.auth.token.email, timestamp: admin.firestore.FieldValue.serverTimestamp(), customerId: 'gridbox-hq' });
    return { success: true };
});

// C. SMS HANDLER (Ontvangt "Open 5" van klanten)
exports.smsHandler = onRequest(async (req, res) => {
    const { originator, body } = req.query; // Bird stuurt dit via Webhook
    if (!originator || !body) return res.status(400).send('Missing info');
    const msg = body.toUpperCase();
    const boxNr = msg.replace(/[^0-9]/g, '');
    const boxId = 'gbox-' + boxNr.padStart(3, '0');
    
    // Check of dit nummer toegang heeft
    const shareDoc = await db.collection('boxes').doc(boxId).collection('shares').doc(originator).get();
    if (!shareDoc.exists) {
        mb.messages.create({ originator: 'Gridbox', recipients: [originator], body: 'Geen toegang tot deze box.' }, () => {});
        return res.status(200).send('Denied');
    }

    const action = msg.includes('CLOSE') ? 'CLOSE' : 'OPEN';
    await db.collection('boxes').doc(boxId).collection('commands').add({ command: action, status: 'pending', requestedBy: 'SMS:' + originator, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    
    const templateName = action === 'OPEN' ? 'confirm_open' : 'confirm_close';
    const tempDoc = await db.collection('smsTemplates').doc(templateName).get();
    mb.messages.create({ originator: 'Gridbox', recipients: [originator], body: tempDoc.exists ? tempDoc.data().body : 'Commando uitgevoerd.' }, () => {});
    
    res.status(200).send('OK');
});

exports.inviteUser = onCall({ cors: true }, async (request) => {
    await db.collection('users').add({ email: request.data.email, role: 'user', status: 'invited', createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return { success: true };
});
