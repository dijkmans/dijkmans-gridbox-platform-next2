import { getFirestore } from "firebase-admin/firestore";
import { initFirebaseAdmin } from "../src/config/firebase";

initFirebaseAdmin();

async function main() {
  const db = getFirestore();
  const doc = await db.collection("boxes").doc("gbox-005").get();

  if (!doc.exists) {
    console.log("Box gbox-005 niet gevonden");
    return;
  }

  const data = doc.data() || {};
  console.log(JSON.stringify({
    id: doc.id,
    active: data.active ?? null,
    hardware: data.hardware ?? null,
    camera: data.camera ?? null
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
