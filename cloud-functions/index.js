const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const Anthropic = require('@anthropic-ai/sdk').default;

admin.initializeApp();
const db = admin.firestore();

const BIRD_WORKSPACE_ID = '145d3c27-76ac-4d6a-9e10-1f7dff2f6bcb';
const BIRD_CHANNEL_ID = 'a703f755-7154-532a-89a0-70103633682e';

async function systemLog(type, boxId, details, severity, resolved) {
    try {
        await db.collection('systemLogs').add({
            type,
            boxId: boxId || null,
            details: details || '',
            severity,
            resolved,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.error('[systemLog] schrijven mislukt:', e.message);
    }
}

async function sendBirdAlert(phone, text) {
    const apiKey = process.env.BIRD_API_KEY || '';
    return fetch(
        `https://api.bird.com/workspaces/${BIRD_WORKSPACE_ID}/channels/${BIRD_CHANNEL_ID}/messages`,
        {
            method: 'POST',
            headers: {
                'Authorization': `AccessKey ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                receiver: { contacts: [{ identifierValue: phone }] },
                body: { type: 'text', text: { text } }
            })
        }
    );
}

async function getAdminPhone() {
    const configRef = db.collection('platformConfig').doc('alerts');
    const snap = await configRef.get();
    const DEFAULT_PHONE = '+32487389473';
    if (!snap.exists || !snap.data().adminPhone) {
        await configRef.set({ adminPhone: DEFAULT_PHONE }, { merge: true });
        return DEFAULT_PHONE;
    }
    return snap.data().adminPhone;
}

async function upsertBirdConversation(phoneNumber, workspaceId, channelId, apiKey) {
    const searchUrl = `https://api.bird.com/workspaces/${workspaceId}/conversations?identifierKey=phonenumber&identifierValue=${encodeURIComponent(phoneNumber)}&channelId=${channelId}`;

    const searchRes = await fetch(searchUrl, {
        headers: { 'Authorization': `AccessKey ${apiKey}`, 'Accept': 'application/json' }
    });

    if (searchRes.ok) {
        const data = await searchRes.json();
        if (data.results && data.results.length > 0) return;
    }

    const createRes = await fetch(`https://api.bird.com/workspaces/${workspaceId}/conversations`, {
        method: 'POST',
        headers: {
            'Authorization': `AccessKey ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            channelId,
            contact: { identifierKey: 'phonenumber', identifierValue: phoneNumber }
        })
    });

    if (!createRes.ok) {
        const err = await createRes.text();
        console.warn(`[BIRD] upsertConversation mislukt voor ${phoneNumber}: ${err}`);
        await systemLog('conversation-upsert-failed', null,
            `upsertConversation mislukt voor ${phoneNumber}: ${err}`, 'warning', false);
    }
}

// 1. LUISTEREN NAAR SHARE (De "Waakhond" voor Staged Delivery)
exports.onShareStatusChanged = onDocumentWritten({
    document: 'boxes/{boxId}/shares/{phoneNumber}',
    region: 'europe-west1'
}, async (event) => {
    const beforeData = event.data.before && event.data.before.exists ? event.data.before.data() : null;
    const afterData = event.data.after && event.data.after.exists ? event.data.after.data() : null;

    if (!afterData) return;

    const wasActive = beforeData ? (beforeData.active === true || beforeData.status === 'active') : false;
    const isNowActive = afterData.active === true || afterData.status === 'active';

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
        let city = '';
        try {
            const boxSnap = await db.collection('boxes').doc(boxId).get();
            const siteId = boxSnap.exists ? boxSnap.data().siteId : null;
            if (siteId) {
                const siteSnap = await db.collection('sites').doc(siteId).get();
                city = (siteSnap.exists && siteSnap.data().city) ? siteSnap.data().city : '';
            }
        } catch (cityErr) {
            console.warn(`[WARN] City niet beschikbaar voor ${boxId}:`, cityErr.message);
        }

        const templateSnap = await db.collection('smsTemplates').doc('invitation').get();
        let body = `Beste ${name}, je hebt toegang tot Gridbox ${boxNr}.`;

        if (templateSnap.exists && templateSnap.data().body) {
            body = templateSnap.data().body
                .replace(/\[customerName\]/g, name)
                .replace(/\[boxNr\]/g, boxNr)
                .replace(/\[shortBoxNr\]/g, shortBoxNr)
                .replace(/\[city\]/g, city);
        }

        phoneNumber = phoneNumber.replace(/\s+/g, '');
        if (phoneNumber.startsWith('0')) phoneNumber = '+32' + phoneNumber.substring(1);
        if (!phoneNumber.startsWith('+')) phoneNumber = '+' + phoneNumber;

        const WORKSPACE_ID = '145d3c27-76ac-4d6a-9e10-1f7dff2f6bcb';
        const CHANNEL_ID = 'a703f755-7154-532a-89a0-70103633682e';
        const API_KEY = process.env.BIRD_API_KEY || '';

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

            await upsertBirdConversation(phoneNumber, WORKSPACE_ID, CHANNEL_ID, API_KEY).catch(err => {
                console.warn('[BIRD] upsertConversation error:', err.message);
            });

            await db.collection('smsLogs').add({
                phoneNumber,
                text: body,
                richting: 'uitgaand',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                boxId,
                trigger: 'share-invitation',
                templateName: 'invitation'
            });
        }

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
exports.smsHandler = onRequest({ region: 'europe-west1' }, async (_req, res) => {
    console.warn('smsHandler is deprecated. Use gridbox-api /webhooks/bird/inbound instead.');
    return res.status(410).send('smsHandler deprecated - use gridbox-api webhook');
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

// 4. HEARTBEAT WATCHDOG – markeert boxes als offline en stuurt eenmalig alert-SMS
exports.checkBoxHeartbeats = onSchedule({
    schedule: 'every 5 minutes',
    region: 'europe-west1',
    timeoutSeconds: 120
}, async (_event) => {
    const now = Date.now();
    const THRESHOLD_MS = 5 * 60 * 1000;

    const adminPhone = await getAdminPhone();
    const snapshot = await db.collection('boxes').get();
    let markedOffline = 0;
    let markedOnline = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const boxId = doc.id;

        const heartbeatStr = data?.software?.lastHeartbeatIso ?? data?.lastHeartbeatAt ?? null;
        if (!heartbeatStr) continue;

        const heartbeatTs = new Date(heartbeatStr).getTime();
        if (isNaN(heartbeatTs)) continue;

        const isStale = now - heartbeatTs > THRESHOLD_MS;

        if (!isStale && data.status === 'offline') {
            // Box came back online
            await doc.ref.update({ status: 'online', alertOfflineSent: false });
            markedOnline++;
            console.log(`[checkBoxHeartbeats] ${boxId} is terug online`);
            await systemLog('box-online', boxId,
                `Box ${boxId} is terug online. Heartbeat: ${heartbeatStr}`, 'info', true);

        } else if (isStale && data.status !== 'offline') {
            // Box just went offline
            await doc.ref.update({ status: 'offline' });
            markedOffline++;
            console.log(`[checkBoxHeartbeats] ${boxId} offline (heartbeat: ${heartbeatStr})`);
            await systemLog('box-offline', boxId,
                `Box ${boxId} geen heartbeat meer. Laatste heartbeat: ${heartbeatStr}`, 'warning', false);

            if (!data.alertOfflineSent) {
                const smsText = `⚠️ ${boxId} is OFFLINE. Pi reageert niet meer. Klanten kunnen de box niet openen via SMS.`;
                try {
                    const smsRes = await sendBirdAlert(adminPhone, smsText);
                    if (smsRes.ok) {
                        await doc.ref.update({ alertOfflineSent: true });
                        console.log(`[checkBoxHeartbeats] Alert SMS verstuurd voor ${boxId}`);
                        await systemLog('sms-alert-sent', boxId,
                            `Offline alert verstuurd naar ${adminPhone} voor ${boxId}`, 'info', true);
                    } else {
                        const errText = await smsRes.text();
                        console.error(`[checkBoxHeartbeats] SMS mislukt voor ${boxId}:`, errText);
                        await systemLog('sms-alert-failed', boxId,
                            `Alert SMS mislukt voor ${boxId}: ${errText}`, 'error', false);
                    }
                } catch (smsErr) {
                    console.error(`[checkBoxHeartbeats] SMS exception voor ${boxId}:`, smsErr.message);
                    await systemLog('sms-alert-failed', boxId,
                        `Alert SMS exception voor ${boxId}: ${smsErr.message}`, 'error', false);
                }
            }
        }
    }

    console.log(`[checkBoxHeartbeats] done — ${markedOffline} offline, ${markedOnline} terug online`);
});

// 5. COMMAND TIMEOUT WATCHDOG – stuurt alert als commando langer dan 3 min op pending staat
exports.checkCommandTimeouts = onSchedule({
    schedule: 'every 5 minutes',
    region: 'europe-west1',
    timeoutSeconds: 120
}, async (_event) => {
    const TIMEOUT_MS = 3 * 60 * 1000;
    const now = Date.now();

    const adminPhone = await getAdminPhone();
    const boxesSnap = await db.collection('boxes').get();
    let timeoutCount = 0;

    for (const boxDoc of boxesSnap.docs) {
        const boxId = boxDoc.id;
        const commandsSnap = await db.collection('boxes').doc(boxId)
            .collection('commands')
            .where('status', '==', 'pending')
            .get();

        for (const cmdDoc of commandsSnap.docs) {
            const cmdData = cmdDoc.data();
            const command = cmdData.command || 'UNKNOWN';

            let createdAtMs;
            if (cmdData.createdAt && typeof cmdData.createdAt.toMillis === 'function') {
                createdAtMs = cmdData.createdAt.toMillis();
            } else if (typeof cmdData.createdAt === 'string') {
                createdAtMs = new Date(cmdData.createdAt).getTime();
            } else {
                continue;
            }

            if (isNaN(createdAtMs) || now - createdAtMs < TIMEOUT_MS) continue;

            const pendingMinutes = Math.floor((now - createdAtMs) / 60000);

            await cmdDoc.ref.update({ status: 'timeout', timedOutAt: new Date().toISOString() });

            await systemLog('command-timeout', boxId,
                `Commando ${command} (${cmdDoc.id}) stond ${pendingMinutes} min op pending. Status gezet op timeout.`,
                'warning', false);

            const smsText = `⚠️ ${boxId}: ${command} commando niet uitgevoerd. Pi mogelijk offline. (al ${pendingMinutes} minuten pending)`;
            try {
                const smsRes = await sendBirdAlert(adminPhone, smsText);
                if (smsRes.ok) {
                    console.log(`[checkCommandTimeouts] Alert verstuurd voor ${boxId}/${command} (${pendingMinutes} min)`);
                    await systemLog('sms-alert-sent', boxId,
                        `Timeout alert verstuurd naar ${adminPhone} voor ${boxId}/${command}`, 'info', true);
                } else {
                    const errText = await smsRes.text();
                    console.error(`[checkCommandTimeouts] SMS mislukt voor ${boxId}/${cmdDoc.id}:`, errText);
                    await systemLog('sms-alert-failed', boxId,
                        `Timeout alert SMS mislukt voor ${boxId}/${command}: ${errText}`, 'error', false);
                }
            } catch (smsErr) {
                console.error(`[checkCommandTimeouts] SMS exception voor ${boxId}:`, smsErr.message);
                await systemLog('sms-alert-failed', boxId,
                    `Timeout alert SMS exception voor ${boxId}/${command}: ${smsErr.message}`, 'error', false);
            }

            timeoutCount++;
        }
    }

    console.log(`[checkCommandTimeouts] done — ${timeoutCount} commando's op timeout gezet`);
});

// 6. OCCUPANCY ANALYSE – vuurt af als Pi pendingOccupancyFilename zet na een post-close sessie
exports.onPendingOccupancySet = onDocumentWritten({
    document: 'boxes/{boxId}',
    region: 'europe-west1',
    timeoutSeconds: 120
}, async (event) => {
    const before = event.data.before?.exists ? event.data.before.data() : null;
    const after = event.data.after?.exists ? event.data.after.data() : null;

    const filename = after?.pendingOccupancyFilename;
    const wasPending = before?.pendingOccupancyFilename;

    if (!filename || filename === wasPending) return null;

    const boxId = event.params.boxId;
    console.log(`[occupancy] trigger voor ${boxId}, bestand: ${filename}`);

    // Verwijder het veld direct zodat herhaalde triggers niet opnieuw vuuren
    await event.data.after.ref.update({ pendingOccupancyFilename: admin.firestore.FieldValue.delete() });

    try {
        const bucket = admin.storage().bucket('gridbox-platform.firebasestorage.app');
        const file = bucket.file(`snapshots/${boxId}/${filename}`);
        const [exists] = await file.exists();
        if (!exists) {
            console.warn(`[occupancy] bestand niet gevonden: snapshots/${boxId}/${filename}`);
            return null;
        }

        const [buffer] = await file.download();
        const base64Image = buffer.toString('base64');

        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const message = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 50,
            messages: [{
                role: 'user',
                content: [
                    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Image } },
                    { type: 'text', text: "You are analyzing a security camera image of a Belgian self-storage box (gridbox). The box is a metal container with corrugated metal walls and a metal floor. Look carefully at the floor and walls. Answer with only one word: 'empty' if the floor is clear with no objects visible, 'occupied' if you can see any items, packages, bicycles, or objects on the floor or leaning against the walls, or 'uncertain' only if the image is completely black or the camera lens is fully obstructed. A slightly dark or grainy image is still analyzable — do not use uncertain just because lighting is imperfect. Be decisive." }
                ]
            }]
        });

        const rawAnswer = ((message.content[0] && message.content[0].text) || '').trim().toLowerCase();
        const result = ['empty', 'occupied', 'uncertain'].find(v => rawAnswer.includes(v)) ?? 'uncertain';

        if (result === 'empty' || result === 'occupied') {
            await event.data.after.ref.update({ occupancy: result });
            console.log(`[occupancy] ${boxId} -> ${result}`);
        } else {
            console.log(`[occupancy] ${boxId} -> uncertain, occupancy niet overschreven`);
        }
    } catch (err) {
        console.error(`[occupancy] analyse fout voor ${boxId}/${filename}:`, err.message);
    }

    return null;
});
