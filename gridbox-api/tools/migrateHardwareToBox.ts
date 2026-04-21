import { getFirestore } from "firebase-admin/firestore";
import { initFirebaseAdmin } from "../src/config/firebase";

async function main() {
  initFirebaseAdmin();
  const db = getFirestore();

  const boxesSnap = await db.collection("boxes").get();
  let migrated = 0;
  let alreadyOk = 0;
  let noSite = 0;
  let noRutOnSite = 0;

  for (const boxDoc of boxesSnap.docs) {
    const boxData = boxDoc.data() as Record<string, any>;
    const boxId = boxData.boxId ?? boxDoc.id;

    // Sla over als hardware.rut al volledig is
    const existingRut = boxData?.hardware?.rut;
    if (existingRut?.ip && existingRut?.username && existingRut?.password) {
      console.log(`[OK]      ${boxId} — hardware.rut al aanwezig`);
      alreadyOk++;
      continue;
    }

    const siteId: string | null = boxData?.siteId ?? null;
    if (!siteId) {
      console.log(`[SKIP]    ${boxId} — geen siteId`);
      noSite++;
      continue;
    }

    const siteDoc = await db.collection("sites").doc(siteId).get();
    if (!siteDoc.exists) {
      console.log(`[SKIP]    ${boxId} — site ${siteId} niet gevonden`);
      noSite++;
      continue;
    }

    const siteData = siteDoc.data() as Record<string, any>;
    const rut = siteData?.rut;
    if (!rut?.ip || !rut?.username || !rut?.password) {
      console.log(`[NO_RUT]  ${boxId} — site ${siteId} heeft geen rut-credentials`);
      noRutOnSite++;
      continue;
    }

    await boxDoc.ref.update({
      "hardware.rut.ip": rut.ip,
      "hardware.rut.username": rut.username,
      "hardware.rut.password": rut.password,
      ...(rut.model ? { "hardware.rut.model": rut.model } : {})
    });

    console.log(`[MIGRATED] ${boxId} — hardware.rut geschreven van site ${siteId}`);
    migrated++;
  }

  console.log("");
  console.log(`Resultaat: ${migrated} gemigreerd, ${alreadyOk} al correct, ${noSite} geen site, ${noRutOnSite} geen rut op site`);
  console.log("RUT-credentials zijn NIET verwijderd van de site. Verwijder die handmatig na verificatie.");
}

main().catch((err) => {
  console.error("Fout:", err);
  process.exit(1);
});
