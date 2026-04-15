"use client";

import { useEffect, useState } from "react";
import { auth, googleProvider } from "@/lib/firebase";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User
} from "firebase/auth";

export default function AuthPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
      setMessage("");
    });

    return () => unsubscribe();
  }, []);

  async function handleLogin() {
    try {
      setMessage("");
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setMessage("Inloggen mislukt");
    }
  }

  async function handleLogout() {
    try {
      setMessage("");
      await signOut(auth);
    } catch (error) {
      setMessage("Uitloggen mislukt");
    }
  }

  if (loading) {
    return <p>Authenticatie laden...</p>;
  }

  return (
    <div
      style={{
        border: "1px solid #ccc",
        borderRadius: "8px",
        padding: "12px",
        marginBottom: "20px"
      }}
    >
      {user ? (
        <>
          <p>
            <strong>Aangemeld als:</strong> {user.displayName || user.email}
          </p>
          <p>
            <strong>E-mail:</strong> {user.email}
          </p>
          <button onClick={handleLogout} style={{ padding: "8px 12px" }}>
            Afmelden
          </button>
        </>
      ) : (
        <>
          <p>Niet aangemeld</p>
          <button onClick={handleLogin} style={{ padding: "8px 12px" }}>
            Aanmelden met Google
          </button>
        </>
      )}

      {message && <p style={{ marginTop: "10px" }}>{message}</p>}
    </div>
  );
}


