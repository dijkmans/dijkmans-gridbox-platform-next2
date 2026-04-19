"use client";

import { useEffect, useState } from "react";
import {
  auth,
  googleProvider,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  magicLinkSettings,
} from "@/lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";

const MAGIC_LINK_EMAIL_KEY = "gridbox_magic_link_email";

export default function AuthPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [magicEmail, setMagicEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [magicError, setMagicError] = useState("");
  const [magicBusy, setMagicBusy] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
      setMessage("");
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return;
    const email = localStorage.getItem(MAGIC_LINK_EMAIL_KEY);
    if (!email) return;
    signInWithEmailLink(auth, email, window.location.href)
      .then(() => localStorage.removeItem(MAGIC_LINK_EMAIL_KEY))
      .catch(() => setMessage("Automatisch inloggen via e-maillink mislukt."));
  }, []);

  async function handleGoogleLogin() {
    try {
      setMessage("");
      await signInWithPopup(auth, googleProvider);
    } catch {
      setMessage("Inloggen mislukt");
    }
  }

  async function handleLogout() {
    try {
      setMessage("");
      await signOut(auth);
    } catch {
      setMessage("Uitloggen mislukt");
    }
  }

  async function handleSendMagicLink() {
    setMagicError("");
    if (!magicEmail.trim()) {
      setMagicError("Vul je e-mailadres in.");
      return;
    }
    try {
      setMagicBusy(true);
      const settings = { ...magicLinkSettings, url: window.location.href };
      await sendSignInLinkToEmail(auth, magicEmail.trim(), settings);
      localStorage.setItem(MAGIC_LINK_EMAIL_KEY, magicEmail.trim());
      setMagicSent(true);
    } catch {
      setMagicError("Kon de link niet versturen. Controleer het e-mailadres.");
    } finally {
      setMagicBusy(false);
    }
  }

  if (loading) return <p>Authenticatie laden...</p>;

  return (
    <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "12px", marginBottom: "20px" }}>
      {user ? (
        <>
          <p><strong>Aangemeld als:</strong> {user.displayName || user.email}</p>
          <p><strong>E-mail:</strong> {user.email}</p>
          <button onClick={() => void handleLogout()} style={{ padding: "8px 12px" }}>
            Afmelden
          </button>
        </>
      ) : (
        <>
          <p>Niet aangemeld</p>
          <button onClick={() => void handleGoogleLogin()} style={{ padding: "8px 12px" }}>
            Aanmelden met Google
          </button>
          <hr style={{ margin: "12px 0" }} />
          {!magicSent ? (
            <>
              <p style={{ marginBottom: "8px", fontSize: "14px" }}>Of ontvang een inloglink via e-mail:</p>
              <input
                type="email"
                value={magicEmail}
                onChange={(e) => setMagicEmail(e.target.value)}
                placeholder="jouw@email.be"
                style={{ padding: "8px", marginRight: "8px", width: "200px" }}
              />
              <button
                onClick={() => void handleSendMagicLink()}
                disabled={magicBusy}
                style={{ padding: "8px 12px" }}
              >
                {magicBusy ? "Versturen\u2026" : "Stuur inloglink"}
              </button>
              {magicError && <p style={{ color: "red", marginTop: "8px" }}>{magicError}</p>}
            </>
          ) : (
            <p style={{ color: "green" }}>
              Inloglink verstuurd naar <strong>{magicEmail}</strong>. Controleer je mailbox en klik op de link.
            </p>
          )}
        </>
      )}
      {message && <p style={{ marginTop: "10px" }}>{message}</p>}
    </div>
  );
}
