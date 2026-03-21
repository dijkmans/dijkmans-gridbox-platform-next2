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

  const [sitesSnap, boxesSnap] = await Promise.all([
    db.collection("sites").get(),
    db.collection("boxes").get()
  ]);

  const sites = sitesSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));

  const boxes = boxesSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      boxId: data.boxId ?? null,
      siteId: data.siteId ?? null,
      customerId: data.customerId ?? null,
      updatedAt: data.updatedAt ?? null
    };
  });

  const output = {
    sitesCount: sites.length,
    boxesCount: boxes.length,
    sites,
    boxes
  };

  fs.writeFileSync("firestore-overview.json", JSON.stringify(output, null, 2), "utf8");
  console.log("Klaar: firestore-overview.json aangemaakt");
  console.log(`Sites: ${sites.length}`);
  console.log(`Boxes: ${boxes.length}`);
}

main().catch((error) => {
  console.error("FOUT bij uitlezen Firestore:");
  console.error(error);
  process.exit(1);
});
