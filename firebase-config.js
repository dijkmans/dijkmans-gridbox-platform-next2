import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "HIER_JOUW_API_KEY_PLAKKEN",
  authDomain: "gridbox-platform.firebaseapp.com",
  projectId: "gridbox-platform",
  storageBucket: "gridbox-platform.appspot.com",
  messagingSenderId: "HIER_JOUW_SENDER_ID_PLAKKEN",
  appId: "HIER_JOUW_APP_ID_PLAKKEN"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
