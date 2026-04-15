import { getFirestore } from "firebase-admin/firestore";

export async function addBoxCommand(
  boxId: string,
  command: "OPEN" | "CLOSE",
  source: string
): Promise<string> {
  const db = getFirestore();

  const docRef = await db.collection("boxes").doc(boxId).collection("commands").add({
    command,
    status: "pending",
    source,
    createdAt: new Date().toISOString()
  });

  return docRef.id;
}

export async function getLatestBoxCommand(boxId: string): Promise<{ id: string; data: Record<string, any> } | null> {
  const db = getFirestore();

  const snapshot = await db
    .collection("boxes")
    .doc(boxId)
    .collection("commands")
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];

  return {
    id: doc.id,
    data: doc.data() as Record<string, any>
  };
}

export async function getBoxCommandById(
  boxId: string,
  commandId: string
): Promise<{ id: string; data: Record<string, any> } | null> {
  const db = getFirestore();

  const doc = await db
    .collection("boxes")
    .doc(boxId)
    .collection("commands")
    .doc(commandId)
    .get();

  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    data: doc.data() as Record<string, any>
  };
}

export async function listBoxCommands(
  boxId: string,
  limitCount = 20
): Promise<Array<{ id: string; data: Record<string, any> }>> {
  const db = getFirestore();

  const snapshot = await db
    .collection("boxes")
    .doc(boxId)
    .collection("commands")
    .orderBy("createdAt", "desc")
    .limit(limitCount)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() as Record<string, any>
  }));
}
