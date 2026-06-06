// Geen verificatie meer: webhook accepteert alle POSTs (zie handler-doc).
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

admin.initializeApp();

// De Firestore-database in powergrid-whatsapp-bot heet "powergrid-bot", niet
// "(default)". Verbind expliciet met die named database — anders 5 NOT_FOUND.
const db = getFirestore('powergrid-bot');

/**
 * Routing-config: de prefix van event_name (het deel vóór de eerste punt)
 * bepaalt de doelcollectie, het id-veld en waar de entiteit in de payload zit.
 *
 * NB: "workshop_order_roadworthy" is een eigen prefix, los van "workshop_order",
 * omdat we matchen op het volledige deel vóór de punt.
 */
const ROUTING = {
    customer:                  { collection: 'klanten',            idField: 'customer_id', payloadKey: 'customer' },
    workshop_order:            { collection: 'herstellingen',      idField: 'order_id',    payloadKey: 'workshop_order' },
    sales_order:               { collection: 'verkopen',           idField: 'order_id',    payloadKey: 'sales_order' },
    store_order:               { collection: 'winkelbestellingen', idField: 'order_id',    payloadKey: 'store_order' },
    payments:                  { collection: 'betalingen',         idField: 'payment_id',  payloadKey: 'payment' },
    workshop_order_roadworthy: { collection: 'keuringen',          idField: 'order_id',    payloadKey: 'workshop_order_roadworthy' },
};

/**
 * Werk de juiste collectie bij op basis van event_name.
 * Gooit bij een echte Firestore-fout (handler vertaalt dat naar 500 + retry).
 * Bij een onbekende event-prefix of ontbrekend id wordt overgeslagen — de ruwe
 * opslag in cyclesoftware_raw is dan nog steeds de bron van waarheid.
 */
async function routeEvent(eventName, body, webhookId) {
    const prefix = (eventName || '').split('.')[0];
    const route = ROUTING[prefix];

    if (!route) {
        console.log(`[cyclesoftware] geen routing voor event "${eventName}" (prefix "${prefix}")`);
        return { routed: false, reason: 'no-route', prefix };
    }

    const payload = body.payload ?? {};
    // Verwachte locatie: payload[payloadKey]. Val terug op de prefix-sleutel of
    // het hele payload-object zodat een licht afwijkende structuur niet breekt.
    const entity = payload[route.payloadKey] ?? payload[prefix] ?? payload;

    const rawId = entity?.[route.idField] ?? payload?.[route.idField] ?? null;
    if (rawId === null || rawId === undefined || rawId === '') {
        console.warn(`[cyclesoftware] id-veld "${route.idField}" ontbreekt voor event "${eventName}"`);
        return { routed: false, reason: 'missing-id', collection: route.collection };
    }

    const docId = String(rawId);
    await db
        .collection(route.collection)
        .doc(docId)
        .set(
            {
                ...entity,
                _lastEvent: eventName,
                _lastWebhookId: webhookId,
                _updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

    console.log(`[cyclesoftware] ${eventName} -> ${route.collection}/${docId}`);
    return { routed: true, collection: route.collection, docId };
}

/**
 * CycleSoftware webhook receiver (project: powergrid-whatsapp-bot).
 *
 * GEEN verificatie: accepteert alle POSTs zonder HMAC of URL-secret. De
 * beveiliging berust uitsluitend op de niet-publieke webhook-URL.
 *
 * - Slaat elk event ONGEFILTERD op in cyclesoftware_raw/{webhook_id}.
 * - Routeert het event naar de juiste collectie (zie ROUTING).
 * - Antwoordt 200 bij succes, 500 bij schrijffout.
 */
exports.cyclesoftwareWebhook = onRequest(
    { region: 'europe-west1' },
    async (req, res) => {
        if (req.method !== 'POST') {
            return res.status(405).json({ ok: false, error: 'method-not-allowed' });
        }

        const body = req.body ?? {};

        // webhook_id = X-CycleSoftware-Delivery header (ook body.id). Val terug op
        // een auto-id zodat we nooit events kwijtraken.
        const webhookId =
            req.header('x-cyclesoftware-delivery') ??
            body.id ??
            db.collection('cyclesoftware_raw').doc().id;

        const eventName = req.header('x-cyclesoftware-event') ?? body.event_name ?? null;

        try {
            await db
                .collection('cyclesoftware_raw')
                .doc(String(webhookId))
                .set(
                    {
                        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
                        eventName,
                        rawBody: body,
                        headers: {
                            'content-type': req.header('content-type') ?? null,
                            'user-agent': req.header('user-agent') ?? null,
                        },
                        processingStatus: 'received',
                    },
                    { merge: true }
                );
        } catch (err) {
            console.error('[cyclesoftware] ruwe opslag mislukt:', err.message);
            return res.status(500).json({ ok: false });
        }

        let routing;
        try {
            routing = await routeEvent(eventName, body, String(webhookId));
        } catch (err) {
            console.error('[cyclesoftware] routing mislukt:', err.message);
            return res.status(500).json({ ok: false, error: 'routing-failed' });
        }

        return res.status(200).json({ ok: true, webhookId: String(webhookId), routing });
    }
);
