import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCmwIzuvHO4KW8qGMGlNFK4cnBzrVivtQE",
  authDomain: "gridbox-platform.firebaseapp.com",
  projectId: "gridbox-platform",
  storageBucket: "gridbox-platform.firebasestorage.app",
  messagingSenderId: "960191535038",
  appId: "1:960191535038:web:af62e61a8daf768a8acbef",
  measurementId: "G-5JVD1S2LKR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore (De database waar je boxes in staan)
export const db = getFirestore(app);

export default app;
