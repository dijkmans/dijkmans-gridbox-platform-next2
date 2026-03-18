import { getFirestore } from "firebase-admin/firestore";
import { initFirebaseAdmin } from "../src/config/firebase";

async function main() {
  initFirebaseAdmin();

  const db = getFirestore();

  await db.collection("customerBoxAccess").add({
    customerId: "gridbox-hq",
    boxId: "gbox-005",
    active: true,
    createdAt: new Date().toISOString(),
    addedBy: "portal-setup"
  });

  console.log("customerBoxAccess record aangemaakt voor gridbox-hq -> gbox-005");
}

main().catch((err) => {
  console.error("FOUT bij aanmaken customerBoxAccess:");
  console.error(err);
  process.exit(1);
});
