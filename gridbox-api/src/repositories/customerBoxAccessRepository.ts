import { getFirestore } from "firebase-admin/firestore";

export async function hasCustomerBoxAccess(
  customerId: string,
  boxId: string
): Promise<boolean> {
  const db = getFirestore();

  const snapshot = await db
    .collection("customerBoxAccess")
    .where("customerId", "==", customerId)
    .where("boxId", "==", boxId)
    .where("active", "==", true)
    .limit(1)
    .get();

  return !snapshot.empty;
}

export async function listBoxIdsForCustomer(customerId: string): Promise<string[]> {
  const db = getFirestore();

  const snapshot = await db
    .collection("customerBoxAccess")
    .where("customerId", "==", customerId)
    .where("active", "==", true)
    .get();

  return snapshot.docs
    .map((doc) => {
      const data = doc.data() as Record<string, any>;
      return typeof data.boxId === "string" ? data.boxId : null;
    })
    .filter((boxId): boxId is string => !!boxId);
}
