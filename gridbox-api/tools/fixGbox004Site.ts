import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initFirebaseAdmin } from "../src/config/firebase";

initFirebaseAdmin();

async function main() {
  const db = getFirestore();
  const boxRef = db.collection("boxes").doc("gbox-004");

  const doc = await boxRef.get();
  if (!doc.exists) {
    console.error("gbox-004 niet gevonden in Firestore");
    process.exit(1);
  }

  const current = doc.data() ?? {};
  console.log("Huidige Firestore-state van gbox-004:");
  console.log("  name      :", current.name ?? "(niet gezet)");
  console.log("  active    :", current.active ?? "(niet gezet)");
  console.log("  siteId    :", current.siteId ?? "(niet gezet)");
  console.log("  customerId:", current.customerId ?? "(niet gezet)");

  // Controleer of de Bocholt site bestaat
  const siteDoc = await db.collection("sites").doc("Powergrid Bocholt").get();
  if (!siteDoc.exists) {
    console.error('Site "Powergrid Bocholt" niet gevonden in sites collectie');
    process.exit(1);
  }
  console.log('\nSite "Powergrid Bocholt" gevonden:', siteDoc.data()?.name);

  await boxRef.update({
    siteId: "Powergrid Bocholt",
    name: FieldValue.delete(),
    active: FieldValue.delete()
  });

  const updated = await boxRef.get();
  const data = updated.data() ?? {};

  console.log("\ngbox-004 na update:");
  console.log("  name      :", data.name ?? "(verwijderd)");
  console.log("  active    :", data.active ?? "(verwijderd)");
  console.log("  siteId    :", data.siteId);
  console.log("  customerId:", data.customerId);
}

main().catch((err) => {
  console.error("Fout:", err);
  process.exit(1);
});
