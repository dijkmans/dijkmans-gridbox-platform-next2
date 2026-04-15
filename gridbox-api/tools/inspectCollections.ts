import { getFirestore } from "firebase-admin/firestore";
import { initFirebaseAdmin } from "../src/config/firebase";

async function main() {
  initFirebaseAdmin();

  const db = getFirestore();
  const collections = await db.listCollections();

  console.log("Top-level collections:");
  for (const col of collections) {
    console.log(`- ${col.id}`);
  }
}

main().catch((err) => {
  console.error("FOUT bij uitlezen Firestore:");
  console.error(err);
  process.exit(1);
});
