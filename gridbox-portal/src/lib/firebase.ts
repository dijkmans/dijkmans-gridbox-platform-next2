import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // Toegevoegd voor de database

const firebaseConfig = {
  apiKey: "AIzaSyCmwIzuvHO4KW8qGMGlNFK4cnBzrVivtQE",
  authDomain: "gridbox-platform.firebaseapp.com",
  projectId: "gridbox-platform",
  storageBucket: "gridbox-platform.firebasestorage.app",
  messagingSenderId: "960191535038",
  appId: "1:960191535038:web:af62e61a8daf768a8acbef"
};

// Initialiseer de Firebase app (voorkomt dubbele initialisatie)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Exporteer de Auth services
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Exporteer de Firestore database instance (cruciaal voor je live dashboard)
export const db = getFirestore(app);