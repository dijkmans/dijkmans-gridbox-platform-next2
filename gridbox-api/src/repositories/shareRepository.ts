import { getFirestore } from "firebase-admin/firestore";

export async function hasActivePortalShare(boxId: string, uid: string): Promise<boolean> {
  const db = getFirestore();

  const doc = await db
    .collection("boxes")
    .doc(boxId)
    .collection("shares")
    .doc(uid)
    .get();

  if (!doc.exists) {
    return false;
  }

  const data = doc.data() as Record<string, any>;

  return data.active === true;
}
