import { getFirestore } from "firebase-admin/firestore";
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

  console.log("Huidige Firestore-state van gbox-004:");
  const current = doc.data() ?? {};
  console.log("  name      :", current.name ?? "(niet gezet)");
  console.log("  active    :", current.active ?? "(niet gezet)");
  console.log("  siteId    :", current.siteId ?? "(niet gezet)");
  console.log("  customerId:", current.customerId ?? "(niet gezet)");

  await boxRef.update({
    name: "Gridbox Geel (oud model)",
    active: false,
    siteId: "powergrid-geel",
    customerId: "powergrid"
  });

  console.log("\ngbox-004 bijgewerkt in Firestore:");
  console.log("  name      : Gridbox Geel (oud model)");
  console.log("  active    : false");
  console.log("  siteId    : powergrid-geel");
  console.log("  customerId: powergrid");

  const updated = await boxRef.get();
  const data = updated.data() ?? {};
  console.log("\nVerificatie na update:");
  console.log("  name      :", data.name);
  console.log("  active    :", data.active);
  console.log("  siteId    :", data.siteId);
  console.log("  customerId:", data.customerId);
}

main().catch((err) => {
  console.error("Fout:", err);
  process.exit(1);
});
