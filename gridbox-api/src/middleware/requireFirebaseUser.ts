import { Request, Response, NextFunction } from "express";
import { getAuth } from "firebase-admin/auth";

export type AuthenticatedRequest = Request & {
  user?: {
    uid: string;
    email?: string;
    phoneNumber?: string;
    emailVerified?: boolean;
    name?: string;
  };
};

export async function requireFirebaseUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      return res.status(401).json({ error: "AUTH_REQUIRED" });
    }

    const idToken = match[1];
    const decoded = await getAuth().verifyIdToken(idToken);
    const userRecord = await getAuth().getUser(decoded.uid);

    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified === true,
      name: decoded.name,
      phoneNumber: userRecord.phoneNumber || undefined,
    };

    return next();
  } catch (error) {
    console.error("requireFirebaseUser error", error);
    return res.status(401).json({ error: "AUTH_REQUIRED" });
  }
}
