import { getFirestore } from "firebase-admin/firestore";

export interface FirestoreSiteDocument {
  id: string;
  data: Record<string, any>;
}

export async function getSiteById(siteId: string): Promise<FirestoreSiteDocument | null> {
  const db = getFirestore();
  const doc = await db.collection("sites").doc(siteId).get();

  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    data: doc.data() as Record<string, any>
  };
}

export async function listSites(): Promise<FirestoreSiteDocument[]> {
  const db = getFirestore();
  const snapshot = await db.collection("sites").get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() as Record<string, any>
  }));
}
