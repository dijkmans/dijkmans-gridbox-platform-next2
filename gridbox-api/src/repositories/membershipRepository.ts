import { getFirestore } from "firebase-admin/firestore";

export type MembershipRecord = {
  id: string;
  email?: string;
  customerId?: string;
  role?: string;
};

export async function getMembershipByEmail(email: string): Promise<MembershipRecord | null> {
  const db = getFirestore();

  const snapshot = await db
    .collection("memberships")
    .where("email", "==", email)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  const data = doc.data() as Record<string, any>;

  return {
    id: doc.id,
    email: data.email,
    customerId: data.customerId,
    role: data.role
  };
}
