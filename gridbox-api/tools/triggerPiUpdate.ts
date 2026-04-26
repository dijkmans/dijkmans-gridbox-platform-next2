import { getFirestore } from "firebase-admin/firestore";
import { initFirebaseAdmin } from "../src/config/firebase";

const TARGET_VERSION = "v1.0.71";

async function main() {
  initFirebaseAdmin();
  const db = getFirestore();
  const boxesSnap = await db.collection("boxes").get();

  for (const doc of boxesSnap.docs) {
    const data = doc.data() as Record<string, any>;
    const boxId = data.boxId ?? doc.id;
    await doc.ref.update({
      "software.targetVersion": TARGET_VERSION,
      "software.softwareUpdateRequested": true
    });
    console.log(`[QUEUED] ${boxId} → ${TARGET_VERSION}`);
  }

  console.log(`\nKlaar — ${boxesSnap.size} boxes getriggerd. Pi's pollen elke 15s.`);
}

main().catch((err) => {
  console.error("Fout:", err);
  process.exit(1);
});
