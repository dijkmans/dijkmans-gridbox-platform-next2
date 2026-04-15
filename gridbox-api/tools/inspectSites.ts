import { getFirestore } from "firebase-admin/firestore";
import { initFirebaseAdmin } from "../src/config/firebase";

async function main() {
  initFirebaseAdmin();

  const db = getFirestore();
  const snapshot = await db.collection("sites").limit(10).get();

  console.log(`Aantal opgehaalde docs: ${snapshot.size}`);
  console.log("");

  for (const doc of snapshot.docs) {
    console.log("==================================================");
    console.log(`DOC ID: ${doc.id}`);
    console.log(JSON.stringify(doc.data(), null, 2));
    console.log("");
  }
}

main().catch((err) => {
  console.error("FOUT bij uitlezen sites:");
  console.error(err);
  process.exit(1);
});
