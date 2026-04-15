import { getFirestore } from "firebase-admin/firestore";
import { initFirebaseAdmin } from "../src/config/firebase";

async function main() {
  initFirebaseAdmin();

  const db = getFirestore();

  const snapshot = await db
    .collection("memberships")
    .where("email", "==", "piet.dijkmans@gmail.com")
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.log("Geen membership gevonden voor piet.dijkmans@gmail.com");
    return;
  }

  const doc = snapshot.docs[0];

  await doc.ref.set(
    {
      email: "piet.dijkmans@gmail.com",
      customerId: "gridbox-hq",
      role: "platformAdmin",
      updatedAt: new Date().toISOString(),
      updatedBy: "recovery-script"
    },
    { merge: true }
  );

  console.log("Membership hersteld naar gridbox-hq / platformAdmin");
}

main().catch((err) => {
  console.error("FOUT bij herstel:");
  console.error(err);
  process.exit(1);
});
