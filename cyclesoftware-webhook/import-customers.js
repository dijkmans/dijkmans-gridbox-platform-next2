/**
 * EENMALIGE bulk-import van alle CycleSoftware-klanten -> Firestore klanten/{customer_id}.
 *
 * Dit is GEEN cron en GEEN onderdeel van de gedeployde function. Handmatig draaien:
 *
 *   cd cyclesoftware-webhook
 *   $env:CYCLESOFTWARE_USERNAME="..."      # PowerShell
 *   $env:CYCLESOFTWARE_PASSWORD="..."
 *   $env:CYCLESOFTWARE_API_KEY="..."
 *   $env:CYCLESOFTWARE_API_BASE="https://api.cyclesoftware.be"   # optioneel, default .nl
 *   node import-customers.js
 *
 * Eerst veilig droogtesten (haalt op + telt, schrijft NIETS, geen ADC nodig):
 *   node import-customers.js --dry-run
 *
 * Firestore-auth gaat via Application Default Credentials. Zorg vooraf voor:
 *   gcloud auth application-default login
 * of zet GOOGLE_APPLICATION_CREDENTIALS naar een service-account-key met
 * schrijfrechten op project powergrid-whatsapp-bot.
 *
 * Node 24 heeft globale fetch() en URL — geen extra dependencies nodig.
 */

const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

// --- Vaste doelconfiguratie (zelfde project/named-DB als de webhook) ---
const PROJECT_ID = 'powergrid-whatsapp-bot';
const DATABASE_ID = 'powergrid-bot';
const COLLECTION = 'klanten';

// --- CycleSoftware REST API ---
const API_BASE = (process.env.CYCLESOFTWARE_API_BASE || 'https://api.cyclesoftware.nl').replace(/\/+$/, '');
const LIST_PATH = '/api/v1/customers/list.json';

const USERNAME = process.env.CYCLESOFTWARE_USERNAME || '';
const PASSWORD = process.env.CYCLESOFTWARE_PASSWORD || '';
const API_KEY = process.env.CYCLESOFTWARE_API_KEY || '';

function requireEnv() {
    const missing = [];
    if (!USERNAME) missing.push('CYCLESOFTWARE_USERNAME');
    if (!PASSWORD) missing.push('CYCLESOFTWARE_PASSWORD');
    if (!API_KEY) missing.push('CYCLESOFTWARE_API_KEY');
    if (missing.length) {
        console.error('Ontbrekende env-variabelen: ' + missing.join(', '));
        process.exit(1);
    }
}

function authHeaders() {
    const basic = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
    return {
        Authorization: `Basic ${basic}`,
        // LET OP: de exacte api-key-header staat niet hard in de CycleSoftware-docs.
        // "api-key" is de meest waarschijnlijke. Werkt het niet, probeer dan bv.
        // "X-Api-Key" of een query-parameter ?api-key=... — pas hier aan.
        'api-key': API_KEY,
        Accept: 'application/json',
    };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Haalt één pagina op. Handelt 429 (rate limit) af met respect voor Retry-After. */
async function fetchPage(offset) {
    const url = new URL(API_BASE + LIST_PATH);
    if (offset != null) url.searchParams.set('offset', String(offset));

    const res = await fetch(url, { headers: authHeaders() });

    if (res.status === 429) {
        const retryAfter = Number(res.headers.get('retry-after')) || 60;
        console.warn(`429 rate limit op offset ${offset} — wacht ${retryAfter}s en probeer opnieuw...`);
        await sleep(retryAfter * 1000);
        return fetchPage(offset);
    }

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${res.statusText} op offset ${offset}: ${text.slice(0, 300)}`);
    }

    const json = await res.json();
    if (json.error) {
        throw new Error(`CycleSoftware API-fout op offset ${offset}: ${json.error_message || 'onbekend'}`);
    }
    return json;
}

async function main() {
    requireEnv();

    // --dry-run: haalt alles op en telt, maar schrijft NIETS naar Firestore
    // (en heeft dus ook geen Application Default Credentials nodig).
    const dryRun = process.argv.includes('--dry-run');

    let db = null;
    let writer = null;
    let writeFouten = 0;

    if (dryRun) {
        console.log('DRY-RUN — er wordt NIETS naar Firestore geschreven.\n');
    } else {
        admin.initializeApp({ projectId: PROJECT_ID });
        db = getFirestore(DATABASE_ID);

        // BulkWriter batcht, throttelt en retryt automatisch — ideaal voor duizenden docs.
        writer = db.bulkWriter();
        writer.onWriteError((err) => {
            // Tot 3 keer opnieuw per document; daarna loggen en doorgaan.
            if (err.failedAttempts < 3) return true;
            writeFouten++;
            console.error(`Schrijven mislukt voor ${err.documentRef.path}: ${err.message}`);
            return false;
        });
    }

    let offset = null; // eerste request zonder offset = vanaf het begin
    let totaal = 0;
    let pagina = 0;
    let voorbeeld = null;

    for (;;) {
        const json = await fetchPage(offset);
        const customers = Array.isArray(json.customers) ? json.customers : [];
        pagina++;

        for (const c of customers) {
            if (c == null || c.customer_id == null) {
                console.warn('Klant zonder customer_id overgeslagen:', JSON.stringify(c).slice(0, 200));
                continue;
            }
            if (!voorbeeld) voorbeeld = c;
            totaal++;

            if (dryRun) continue; // niet schrijven in dry-run

            const docId = String(c.customer_id);
            writer.set(
                db.collection(COLLECTION).doc(docId),
                {
                    ...c,
                    _source: 'bulk-import',
                    _importedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
            );
        }

        const next = json.pagination ? json.pagination.next_offset : null;
        console.log(
            `Pagina ${pagina}: ${customers.length} klanten (offset ${offset ?? 0}), ` +
            `lopend totaal ${totaal}, next_offset ${next}`
        );

        if (next == null) break;
        offset = next;
    }

    if (dryRun) {
        console.log(`\nDRY-RUN klaar. ${totaal} klanten zouden geïmporteerd worden naar ${DATABASE_ID}/${COLLECTION}.`);
        if (voorbeeld) {
            console.log('\nVoorbeeld (eerste klant zoals ontvangen):');
            console.log(JSON.stringify(voorbeeld, null, 2).slice(0, 1000));
        }
        return;
    }

    await writer.close(); // wacht tot alle writes klaar zijn
    console.log(`\nKlaar. ${totaal} klanten verwerkt naar ${DATABASE_ID}/${COLLECTION}.`);
    if (writeFouten) console.warn(`Let op: ${writeFouten} document(en) faalden na retries.`);
}

main().catch((err) => {
    console.error('Import mislukt:', err);
    process.exit(1);
});
