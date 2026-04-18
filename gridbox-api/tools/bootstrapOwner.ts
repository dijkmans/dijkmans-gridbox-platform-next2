import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initFirebaseAdmin } from "../src/config/firebase";

const OWNER_EMAIL = "piet.dijkmans@gmail.com";
const OWNER_AUTH_UID = "RjrvuSnE8XM8MCuIcYP6XWKeDsI2";
const OWNER_DISPLAY_NAME = "Piet Dijkmans";

async function main() {
  initFirebaseAdmin();
  const db = getFirestore();

  const existing = await db
    .collection("memberships")
    .where("email", "==", OWNER_EMAIL)
    .where("role", "==", "platformAdmin")
    .get();

  if (!existing.empty) {
    console.log("✅ platformAdmin membership bestaat al voor", OWNER_EMAIL);
    existing.docs.forEach(doc => console.log("   doc id:", doc.id, "| active:", doc.data().active));
    return;
  }

  const now = Timestamp.now();
  const ref = db.collection("memberships").doc();

  await ref.set({
    authUid: OWNER_AUTH_UID,
    email: OWNER_EMAIL,
    displayName: OWNER_DISPLAY_NAME,
    phoneNumber: null,
    phoneVerified: false,
    customerId: null,
    role: "platformAdmin",
    scope: {},
    active: true,
    invitedByAuthUid: "owner-bootstrap",
    inviteId: "owner-bootstrap",
    createdAt: now,
    activatedAt: now,
  });

  console.log("✅ platformAdmin membership aangemaakt!");
  console.log("   doc id:", ref.id);
  console.log("   email:", OWNER_EMAIL);
  console.log("   authUid:", OWNER_AUTH_UID);
}

main().catch(err => {
  console.error("❌ FOUT:", err);
  process.exit(1);
});
