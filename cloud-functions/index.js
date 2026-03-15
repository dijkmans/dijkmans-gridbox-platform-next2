const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
// De enige juiste manier om Bird te initialiseren in deze versie:
const mb = require('messagebird').initClient('NzCP9BR7gRtERq0KCYi6DbPaZ3ZkwAxsmjS6');

admin.initializeApp();
const db = admin.firestore();

exports.createShare = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Log in verplicht.');
    const { boxId, phoneNumber, name, description } = request.data;
    try {
        const shareRef = db.collection('boxes').doc(boxId).collection('shares').doc(phoneNumber);
        await shareRef.set({
            name: name,
            description: description || 'Toegang via portaal',
            active: true,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        const templateSnap = await db.collection('smsTemplates').doc('invitation').get();
        let smsBody = templateSnap.exists ? templateSnap.data().body : 'Beste [customerName], je hebt toegang tot Gridbox [boxId].';
        smsBody = smsBody.replace('[customerName]', name).replace('[boxId]', boxId);
        smsBody += '\n\nStuur "Open ' + boxId.split('-')[1] + '" naar dit nummer om te openen.';
        
        return new Promise((resolve) => {
            mb.messages.create({
                originator: 'Gridbox',
                recipients: [phoneNumber],
                body: smsBody
            }, async (err, response) => {
                if (err) {
                    console.error('Bird error:', err);
                    await shareRef.update({ status: 'failed' });
                    resolve({ success: false, message: 'SMS mislukt.' });
                } else {
                    await shareRef.update({ status: 'sent', birdId: response.id });
                    resolve({ success: true, message: 'SMS verzonden naar ' + name + '!' });
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
