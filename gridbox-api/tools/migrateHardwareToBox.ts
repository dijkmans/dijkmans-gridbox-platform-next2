import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initFirebaseAdmin } from "../src/config/firebase";

async function main() {
  initFirebaseAdmin();
  const db = getFirestore();

  const boxesSnap = await db.collection("boxes").get();
  let migrated = 0;
  let alreadyOk = 0;
  let skipped = 0;

  for (const boxDoc of boxesSnap.docs) {
    const boxData = boxDoc.data() as Record<string, any>;
    const boxId = boxData.boxId ?? boxDoc.id;

    const topLevelRut = boxData?.rut as Record<string, any> | undefined;
    const existingHwRut = boxData?.hardware?.rut as Record<string, any> | undefined;

    const alreadyMigrated =
      existingHwRut?.config?.ip &&
      existingHwRut?.config?.username &&
      existingHwRut?.config?.password &&
      !topLevelRut &&
      !existingHwRut?.ip &&
      !existingHwRut?.mac &&
      !existingHwRut?.serial;

    if (alreadyMigrated) {
      console.log(`[OK]       ${boxId} — al in eindstructuur`);
      alreadyOk++;
      continue;
    }

    const update: Record<string, any> = {};
    const deleteUpdate: Record<string, any> = {};

    // 1. Top-level rut → hardware.rut.config
    if (topLevelRut) {
      if (typeof topLevelRut.ip === "string") update["hardware.rut.config.ip"] = topLevelRut.ip;
      if (typeof topLevelRut.username === "string") update["hardware.rut.config.username"] = topLevelRut.username;
      if (typeof topLevelRut.password === "string") update["hardware.rut.config.password"] = topLevelRut.password;
      if (typeof topLevelRut.model === "string") update["hardware.rut.config.model"] = topLevelRut.model;
      // mac gaat naar observed (optie A: MAC is observed-only)
      if (typeof topLevelRut.mac === "string") update["hardware.rut.observed.mac"] = topLevelRut.mac;
      deleteUpdate["rut"] = FieldValue.delete();
    }

    // 2. Platte hardware.rut.ip/mac/serial → hardware.rut.observed
    if (existingHwRut) {
      if (typeof existingHwRut.ip === "string") {
        update["hardware.rut.observed.ip"] = existingHwRut.ip;
      }
      if (typeof existingHwRut.mac === "string") {
        update["hardware.rut.observed.mac"] = existingHwRut.mac;
      }
      if (typeof existingHwRut.serial === "string") {
        update["hardware.rut.observed.serial"] = existingHwRut.serial;
      }
      // top-level config velden die onder hardware.rut stonden (legacy plat)
      if (typeof existingHwRut.ip === "string" && !existingHwRut.config) {
        update["hardware.rut.config.ip"] = existingHwRut.ip;
      }
      if (typeof existingHwRut.username === "string") update["hardware.rut.config.username"] = existingHwRut.username;
      if (typeof existingHwRut.password === "string") update["hardware.rut.config.password"] = existingHwRut.password;
      if (typeof existingHwRut.model === "string") update["hardware.rut.config.model"] = existingHwRut.model;

      if (existingHwRut.ip !== undefined) deleteUpdate["hardware.rut.ip"] = FieldValue.delete();
      if (existingHwRut.mac !== undefined) deleteUpdate["hardware.rut.mac"] = FieldValue.delete();
      if (existingHwRut.serial !== undefined) deleteUpdate["hardware.rut.serial"] = FieldValue.delete();
      if (existingHwRut.username !== undefined) deleteUpdate["hardware.rut.username"] = FieldValue.delete();
      if (existingHwRut.password !== undefined) deleteUpdate["hardware.rut.password"] = FieldValue.delete();
      if (existingHwRut.model !== undefined) deleteUpdate["hardware.rut.model"] = FieldValue.delete();
    }

    if (Object.keys(update).length === 0 && Object.keys(deleteUpdate).length === 0) {
      console.log(`[SKIP]     ${boxId} — niets te migreren`);
      skipped++;
      continue;
    }

    if (Object.keys(update).length > 0) {
      await boxDoc.ref.update(update);
    }
    if (Object.keys(deleteUpdate).length > 0) {
      await boxDoc.ref.update(deleteUpdate);
    }

    console.log(`[MIGRATED] ${boxId} — config/observed geschreven, oude velden verwijderd`);
    migrated++;
  }

  console.log("");
  console.log(`Resultaat: ${migrated} gemigreerd, ${alreadyOk} al correct, ${skipped} overgeslagen`);
}

main().catch((err) => {
  console.error("Fout:", err);
  process.exit(1);
});
