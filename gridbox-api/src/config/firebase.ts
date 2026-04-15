import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";

export function initFirebaseAdmin(): void {
  if (getApps().length > 0) {
    return;
  }

  initializeApp({
    credential: applicationDefault()
  });
}
