const { initializeApp, applicationDefault, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");

async function main() {
  if (getApps().length === 0) {
    initializeApp({
      credential: applicationDefault()
    });
  }

  const db = getFirestore();
  const snap = await db.collection("boxes").get();

  const boxes = snap.docs.map((doc) => ({
    id: doc.id,
    data: doc.data()
  }));

  fs.writeFileSync("firestore-boxes-full.json", JSON.stringify(boxes, null, 2), "utf8");
  console.log("Klaar: firestore-boxes-full.json aangemaakt");
  console.log(`Boxes: ${boxes.length}`);
}

main().catch((error) => {
  console.error("FOUT bij uitlezen boxes:");
  console.error(error);
  process.exit(1);
});
