import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from "firebase/auth";
import type { ActionCodeSettings } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCmwIzuvHO4KW8qGMGlNFK4cnBzrVivtQE",
  authDomain: "gridbox-platform.firebaseapp.com",
  projectId: "gridbox-platform",
  storageBucket: "gridbox-platform.firebasestorage.app",
  messagingSenderId: "960191535038",
  appId: "1:960191535038:web:af62e61a8daf768a8acbef"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

export { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink };

export const magicLinkSettings: ActionCodeSettings = {
  url: "https://gridbox-platform.web.app",
  handleCodeInApp: true,
};