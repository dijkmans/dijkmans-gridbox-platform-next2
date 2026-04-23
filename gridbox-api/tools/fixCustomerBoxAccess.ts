import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "fs";

const SERVICE_ACCOUNT_PATH = "C:/Users/USER/dijkmans-gridbox-platform-next2/gridbox-api/service-account.json";
const TARGET_CUSTOMER_ID = "powergrid";
const BOX_IDS_TO_DEACTIVATE = ["gbox-005", "gbox-020"];

async function main(): Promise<void> {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error(`service-account.json niet gevonden op: ${SERVICE_ACCOUNT_PATH}`);
    process.exit(1);
  }

  initializeApp({ credential: cert(SERVICE_ACCOUNT_PATH) });

  const db = getFirestore();

  console.log(`\nStap 1: Alle customerBoxAccess records ophalen voor customerId="${TARGET_CUSTOMER_ID}"...\n`);

  const snapshot = await db.collection("customerBoxAccess")
    .where("customerId", "==", TARGET_CUSTOMER_ID)
    .get();

  if (snapshot.empty) {
    console.log("Geen records gevonden. Niets te doen.");
    return;
  }

  console.log(`${snapshot.docs.length} record(s) gevonden:\n`);
  for (const doc of snapshot.docs) {
    const d = doc.data();
    console.log(`  - id: ${doc.id} | boxId: ${d.boxId} | active: ${d.active} | addedBy: ${d.addedBy ?? "?"}`);
  }

  const toDeactivate = snapshot.docs.filter((doc) =>
    BOX_IDS_TO_DEACTIVATE.includes(doc.data().boxId)
  );

  if (toDeactivate.length === 0) {
    console.log("\nGeen records om te deactiveren (gbox-005 / gbox-020 niet gevonden onder powergrid).");
    return;
  }

  console.log(`\nStap 2: ${toDeactivate.length} record(s) deactiveren...\n`);

  for (const doc of toDeactivate) {
    await doc.ref.set(
      { active: false, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    console.log(`  ✓ Gedeactiveerd: ${doc.id} (boxId: ${doc.data().boxId})`);
  }

  console.log("\nKlaar. De bovenstaande records zijn gezet op active: false.");
}

main().catch((err) => {
  console.error("Script fout:", err);
  process.exit(1);
});
