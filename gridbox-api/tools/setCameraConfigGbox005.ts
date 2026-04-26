import { getFirestore } from "firebase-admin/firestore";
import { initFirebaseAdmin } from "../src/config/firebase";

initFirebaseAdmin();

async function main() {
  const db = getFirestore();
  const boxRef = db.collection("boxes").doc("gbox-005");

  const doc = await boxRef.get();
  if (!doc.exists) {
    console.error("gbox-005 niet gevonden in Firestore");
    process.exit(1);
  }

  await boxRef.update({
    "hardware.camera.assignment.snapshotUrl": "http://192.168.10.158/cgi-bin/snapshot.cgi",
    "hardware.camera.config.enabled":         true,
    "hardware.camera.config.username":         "admin",
    "hardware.camera.config.password":         "admin1",
  });

  console.log("Camera config bijgewerkt voor gbox-005:");
  console.log("  snapshotUrl : http://192.168.10.158/cgi-bin/snapshot.cgi");
  console.log("  username    : admin");
  console.log("  password    : admin1");
  console.log("  enabled     : true");

  const updated = await boxRef.get();
  const cam = updated.data()?.hardware?.camera ?? {};
  console.log("\nFirestore camera state na update:");
  console.log(JSON.stringify(cam, null, 2));
}

main().catch((err) => {
  console.error("Fout:", err);
  process.exit(1);
});
