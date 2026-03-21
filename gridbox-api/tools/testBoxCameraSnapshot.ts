import { getFirestore } from "firebase-admin/firestore";
import { initFirebaseAdmin } from "../src/config/firebase";
import { writeFileSync } from "fs";
import path from "path";

initFirebaseAdmin();

async function main() {
  const db = getFirestore();
  const doc = await db.collection("boxes").doc("gbox-005").get();

  if (!doc.exists) {
    console.log("Box gbox-005 niet gevonden");
    return;
  }

  const data = doc.data() || {};
  const camera = data.hardware?.camera;

  if (!camera || camera.enabled !== true) {
    console.log("Camera niet actief of niet geconfigureerd");
    return;
  }

  const snapshotUrl = camera.snapshotUrl;
  const username = camera.username;
  const password = camera.password;

  if (typeof snapshotUrl !== "string" || !snapshotUrl) {
    console.log("Geen snapshotUrl gevonden");
    return;
  }

  if (typeof username !== "string" || typeof password !== "string") {
    console.log("Camera credentials ontbreken");
    return;
  }

  const auth = Buffer.from(`${username}:${password}`).toString("base64");

  console.log("Snapshot test gestart...");
  console.log(`URL aanwezig: ja`);
  console.log(`Host: ${new URL(snapshotUrl).host}`);

  const res = await fetch(snapshotUrl, {
    headers: {
      Authorization: `Basic ${auth}`
    }
  });

  console.log(`HTTP status: ${res.status}`);
  console.log(`Content-Type: ${res.headers.get("content-type") || "onbekend"}`);

  if (!res.ok) {
    const text = await res.text();
    console.log("Snapshot ophalen mislukt.");
    console.log(text.slice(0, 500));
    return;
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const outPath = path.join(process.cwd(), "camera-test-gbox-005.jpg");
  writeFileSync(outPath, buffer);

  console.log(`Bytes ontvangen: ${buffer.length}`);
  console.log(`Bestand opgeslagen: ${outPath}`);
}

main().catch((error) => {
  console.error("FOUT bij snapshot test");
  console.error(error);
  process.exit(1);
});
