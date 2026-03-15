const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const mb = require('messagebird').initClient('NzCP9BR7gRtERq0KCYi6DbPaZ3ZkwAxsmjS6');

admin.initializeApp();
const db = admin.firestore();

exports.createShare = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Inloggen verplicht.');
    let { boxId, phoneNumber, name, description } = request.data;
    
    // Nummer opschonen voor Bird
    phoneNumber = phoneNumber.replace(/\s+/g, '');
    if (!phoneNumber.startsWith('+')) phoneNumber = '+' + phoneNumber;

    try {
        const shareRef = db.collection('boxes').doc(boxId).collection('shares').doc(phoneNumber);
        await shareRef.set({
            name: name,
            description: description || 'Toegang via dashboard',
            active: true,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const templateSnap = await db.collection('smsTemplates').doc('invitation').get();
        let smsBody = templateSnap.exists ? templateSnap.data().body : 'Beste [customerName], je hebt toegang tot Gridbox [boxId].';
        smsBody = smsBody.replace('[customerName]', name).replace('[boxId]', boxId);
        smsBody += '\n\nStuur "Open ' + boxId.split('-')[1] + '" om te openen.';
        
        return new Promise((resolve) => {
            mb.messages.create({
                originator: 'Gridbox',
                recipients: [phoneNumber],
                body: smsBody
            }, async (err, response) => {
                if (err) {
                    await shareRef.update({ status: 'failed', error: err.errors[0].description });
                    resolve({ success: false, message: 'SMS mislukt: ' + err.errors[0].description });
                } else {
                    await shareRef.update({ status: 'sent', birdId: response.id });
                    resolve({ success: true, message: 'SMS verzonden naar ' + name });
                }
            });
        });
    } catch (error) { throw new HttpsError('internal', error.message); }
});

exports.openBox = onCall({ cors: true }, async (request) => {
    const { boxId, action } = request.data;
    const cmd = (action === 'CLOSE') ? 'CLOSE' : 'OPEN';
    await db.collection('boxes').doc(boxId).collection('commands').add({
        command: cmd, status: 'pending', requestedBy: request.auth.token.email, createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
});

exports.inviteUser = onCall({ cors: true }, async (request) => {
    await db.collection('users').add({ email: request.data.email, role: 'user', status: 'invited', createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return { success: true };
});
