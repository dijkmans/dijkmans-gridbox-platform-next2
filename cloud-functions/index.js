const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const mb = require('messagebird').initClient('bRoknKEna83EdGVd7wF2VF6ZpAKcP1IXWh4A');

admin.initializeApp();
const db = admin.firestore();

// 1. CREATESHARE (SMS VERSTUREN)
exports.createShare = onCall({ region: 'europe-west1', cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Log in verplicht.');
    
    let { boxId, phoneNumber, name } = request.data;
    
    // Telefoonnummer opschonen
    phoneNumber = phoneNumber.replace(/\s+/g, '');
    if (phoneNumber.startsWith('0')) phoneNumber = '+32' + phoneNumber.substring(1);
    if (!phoneNumber.startsWith('+')) phoneNumber = '+' + phoneNumber;

    const shareRef = db.collection('boxes').doc(boxId).collection('shares').doc(phoneNumber);

    try {
        // Maak alvast de share aan in de database
        await shareRef.set({ 
            name, 
            active: true, 
            status: 'sending', 
            createdAt: admin.firestore.FieldValue.serverTimestamp() 
        });

        // Stel de SMS tekst samen
        let body = `Beste ${name}, je hebt toegang tot Gridbox ${boxId}. \n\nStuur "Open ${boxId.split('-')[1]}" om de box te openen.`;

        // SMS versturen via MessageBird
        return new Promise((resolve) => {
            mb.messages.create({
                originator: 'Gridbox', // TIP: Verander dit in je eigen GSM nr als 'Gridbox' niet werkt
                recipients: [phoneNumber],
                body: body
            }, async (err, response) => {
                if (err) {
                    console.error("MessageBird Error:", err);
                    const errorDesc = err.errors && err.errors[0] ? err.errors[0].description : 'Onbekende API fout';
                    await shareRef.update({ status: 'failed', error: errorDesc });
                    resolve({ success: false, message: 'SMS kon niet worden verzonden: ' + errorDesc });
                } else {
                    await shareRef.update({ status: 'sent', birdId: response.id, error: null });
                    resolve({ success: true, message: 'SMS succesvol verzonden!' });
                }
            });
        });
    } catch (e) {
        await shareRef.update({ status: 'error', error: e.message });
        throw new HttpsError('internal', e.message);
    }
});

// 2. OPEN BOX (MET AUDIT LOG)
exports.openBox = onCall({ region: 'europe-west1', cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Log in verplicht.');
    
    const { boxId } = request.data;
    const userEmail = request.auth.token.email;

    // A. Commando voor de hardware
    await db.collection('boxes').doc(boxId).collection('commands').add({
        command: 'OPEN',
        status: 'pending',
        requestedBy: userEmail,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // B. Schrijf naar Audit Log (Voor je kaart en lijst!)
    await db.collection('auditLogs').add({
        boxId: boxId,
        userEmail: userEmail,
        action: 'Box geopend via Portaal',
        customerId: 'CUST-001', // Dit zou je dynamisch kunnen maken
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, message: `Sleutel omgedraaid voor ${boxId}` };
});

// 3. SMS HANDLER (VOOR INKOMENDE SMS)
exports.smsHandler = onRequest({ region: 'europe-west1' }, async (req, res) => {
    const { originator, body } = req.query;
    if (!originator || !body) return res.status(400).send('Missing info');

    const msg = body.toUpperCase();
    const boxNr = msg.replace(/[^0-9]/g, '');
    const boxId = 'gbox-' + boxNr.padStart(3, '0');

    await db.collection('boxes').doc(boxId).collection('commands').add({ 
        command: 'OPEN', 
        status: 'pending', 
        requestedBy: 'SMS:' + originator, 
        createdAt: admin.firestore.FieldValue.serverTimestamp() 
    });

    res.status(200).send('OK');
});

exports.inviteUser = onCall({ region: 'europe-west1', cors: true }, async (request) => {
    await db.collection('users').add({ 
        email: request.data.email, 
        customerId: 'CUST-001',
        role: 'user', 
        status: 'invited', 
        createdAt: admin.firestore.FieldValue.serverTimestamp() 
    });
    return { success: true };
});
