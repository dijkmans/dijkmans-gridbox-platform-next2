import { getFirestore } from "firebase-admin/firestore";
import { initFirebaseAdmin } from "../src/config/firebase";

async function main() {
  initFirebaseAdmin();

  const db = getFirestore();

  await db
    .collection("boxes")
    .doc("gbox-005")
    .collection("shares")
    .doc("1PI212PQvaekNCb5MufMRD38Djz2")
    .set({
      email: "piet.dijkmans@gmail.com",
      name: "Piet Dijkmans",
      role: "owner",
      active: true,
      createdAt: new Date().toISOString(),
      addedBy: "portal-setup"
    }, { merge: true });

  console.log("UID-share aangemaakt of bijgewerkt voor gbox-005");
}

main().catch((err) => {
  console.error("FOUT bij aanmaken uid-share:");
  console.error(err);
  process.exit(1);
});
