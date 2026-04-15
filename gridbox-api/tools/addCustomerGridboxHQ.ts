import { getFirestore } from "firebase-admin/firestore";
import { initFirebaseAdmin } from "../src/config/firebase";

async function main() {
  initFirebaseAdmin();

  const db = getFirestore();

  await db.collection("customers").doc("gridbox-hq").set(
    {
      name: "Gridbox HQ",
      active: true,
      createdAt: new Date().toISOString(),
      addedBy: "portal-setup"
    },
    { merge: true }
  );

  console.log("Customer gridbox-hq aangemaakt of bijgewerkt");
}

main().catch((err) => {
  console.error("FOUT bij aanmaken customer:");
  console.error(err);
  process.exit(1);
});
