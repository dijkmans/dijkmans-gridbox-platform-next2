const { initializeApp, applicationDefault, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { mapFirestoreBoxToPortalBox } = require("../dist/mappers/boxMapper");
const fs = require("fs");

async function main() {
  if (getApps().length === 0) {
    initializeApp({
      credential: applicationDefault()
    });
  }

  const db = getFirestore();

  const [boxesSnap, sitesSnap] = await Promise.all([
    db.collection("boxes").get(),
    db.collection("sites").get()
  ]);

  const boxDocs = boxesSnap.docs.map((doc) => ({
    id: doc.id,
    data: doc.data()
  }));

  const siteDocs = sitesSnap.docs.map((doc) => ({
    id: doc.id,
    data: doc.data()
  }));

  const mapped = boxDocs.map((doc) => mapFirestoreBoxToPortalBox(doc, siteDocs));

  fs.writeFileSync("portal-box-mapping.json", JSON.stringify(mapped, null, 2), "utf8");
  console.log("Klaar: portal-box-mapping.json aangemaakt");
  console.log(JSON.stringify(mapped, null, 2));
}

main().catch((error) => {
  console.error("FOUT bij portal box mapping:");
  console.error(error);
  process.exit(1);
});
