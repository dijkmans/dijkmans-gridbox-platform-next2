import { getAuth } from "firebase-admin/auth";

export type VerifiedPortalUser = {
  uid: string;
  email?: string;
  name?: string;
};

export async function verifyBearerToken(
  authHeader?: string
): Promise<VerifiedPortalUser | null> {
  if (!authHeader) {
    return null;
  }

  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  const idToken = authHeader.slice("Bearer ".length).trim();

  if (!idToken) {
    return null;
  }

  const decoded = await getAuth().verifyIdToken(idToken);

  return {
    uid: decoded.uid,
    email: decoded.email,
    name: decoded.name
  };
}

export async function requirePortalUser(authHeader?: string): Promise<VerifiedPortalUser> {
  const user = await verifyBearerToken(authHeader);

  if (!user) {
    const error = new Error("UNAUTHORIZED");
    (error as any).statusCode = 401;
    throw error;
  }

  return user;
}
