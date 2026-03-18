import { getFirestore } from "firebase-admin/firestore";

export type CustomerRecord = {
  id: string;
  name?: string;
  active?: boolean;
};

export async function getCustomerById(customerId: string): Promise<CustomerRecord | null> {
  const db = getFirestore();

  const doc = await db.collection("customers").doc(customerId).get();

  if (!doc.exists) {
    return null;
  }

  const data = doc.data() as Record<string, any>;

  return {
    id: doc.id,
    name: data.name,
    active: data.active
  };
}
