import { getFirestore } from "firebase-admin/firestore";

export interface FirestoreBoxDocument {
  id: string;
  data: Record<string, any>;
}

export async function listBoxes(): Promise<FirestoreBoxDocument[]> {
  const db = getFirestore();
  const snapshot = await db.collection("boxes").get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() as Record<string, any>
  }));
}

export async function getBoxById(boxId: string): Promise<FirestoreBoxDocument | null> {
  const db = getFirestore();
  const doc = await db.collection("boxes").doc(boxId).get();

  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    data: doc.data() as Record<string, any>
  };
}
