"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { apiUrl } from "@/lib/api";
import { button, card, alert, input, badge, typography, cx } from "@/lib/design-tokens";

type InviteValidationResult = {
  valid: boolean;
  inviteId?: string;
  email?: string | null;
  displayName?: string | null;
  customerId?: string | null;
  role?: string | null;
  scope?: {
    permissions?: string[];
    siteIds?: string[];
    boxIds?: string[];
  };
  expiresAt?: string;
  status?: string;
  phoneVerified?: boolean;
  phoneNumber?: string | null;
  phoneVerificationStatus?: string;
};

type AuthState = {
  loading: boolean;
  email: string;
  uid: string;
  displayName: string;
};

function normalizeEmail(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function isValidPhone(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value.trim());
}

function roleLabel(role: string | null | undefined): string {
  if (role === "platformAdmin") return "Platformbeheerder";
  if (role === "customerAdmin") return "Beheerder";
  if (role === "customerOperator") return "Operator";
  return role || "-";
}

function PageContentRouter() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [invite, setInvite] = useState<InviteValidationResult | null>(null);

  const [authState, setAuthState] = useState<AuthState>({
    loading: true,
    email: "",
    uid: "",
    displayName: "",
  });

  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [phoneCode, setPhoneCode] = useState("");

  const [busy, setBusy] = useState(false);
  const [stepError, setStepError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthState({
        loading: false,
        email: user?.email || "",
        uid: user?.uid || "",
        displayName: user?.displayName || "",
      });
    });
    return () => unsubscribe();
  }, []);

  async function loadInviteValidation(currentToken: string) {
    const res = await fetch(apiUrl("/invites/validate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: currentToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Kon uitnodiging niet valideren");
    setInvite(data);
    if (data.phoneNumber) setPhoneNumber(data.phoneNumber);
    return data as InviteValidationResult;
  }

  useEffect(() => {
    async function validateInvite() {
      try {
        setLoading(true);
        setErrorMessage("");
        setInvite(null);
        if (!token) {
          setErrorMessage("Geen uitnodigingslink gevonden. Controleer de link en probeer opnieuw.");
          return;
        }
        const data = await loadInviteValidation(token);
        if (data.status === "accepted") setDone(true);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Netwerkfout bij het laden van de uitnodiging"
        );
      } finally {
        setLoading(false);
      }
    }
    void validateInvite();
  }, [token]);

  async function handleGoogleLogin() {
    try {
      setStepError("");
      await signInWithPopup(auth, googleProvider);
    } catch {
      setStepError("Inloggen mislukt. Probeer opnieuw.");
    }
  }

  async function handleLogout() {
    await signOut(auth);
  }

  async function handleSendCode() {
    setStepError("");
    if (!phoneNumber.trim()) {
      setStepError("Vul je gsm-nummer in.");
      return;
    }
    if (!isValidPhone(phoneNumber)) {
      setStepError("Gebruik internationaal formaat, bijvoorbeeld +32475123456.");
      return;
    }
    try {
      setBusy(true);
      const res = await fetch(apiUrl("/invites/send-phone-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, phoneNumber: phoneNumber.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStepError(data.message || data.error || "Kon de code niet versturen.");
        return;
      }
      setPhoneCodeSent(true);
    } catch {
      setStepError("Netwerkfout bij het versturen van de code.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyAndAccept() {
    setStepError("");
    if (!phoneCode.trim()) {
      setStepError("Vul de ontvangen code in.");
      return;
    }
    try {
      setBusy(true);

      const verifyRes = await fetch(apiUrl("/invites/verify-phone-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, code: phoneCode.trim() }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        setStepError(verifyData.message || verifyData.error || "Code klopt niet. Probeer opnieuw.");
        return;
      }

      const user = auth.currentUser;
      if (!user) {
        setStepError("Sessie verlopen. Log opnieuw in.");
        return;
      }
      const idToken = await user.getIdToken();

      const acceptRes = await fetch(apiUrl("/invites/accept"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          token,
          displayName: user.displayName || invite?.displayName || "",
        }),
      });
      const acceptData = await acceptRes.json();
      if (!acceptRes.ok) {
        setStepError(acceptData.message || acceptData.error || "Activatie mislukt.");
        return;
      }

      setDone(true);
    } catch {
      setStepError("Netwerkfout bij het activeren van de uitnodiging.");
    } finally {
      setBusy(false);
    }
  }

  const inviteEmail = normalizeEmail(invite?.email);
  const loggedInEmail = normalizeEmail(authState.email);
  const emailMatches = !!(inviteEmail && loggedInEmail && inviteEmail === loggedInEmail);

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center px-4 py-12">
      <div className="w-full" style={{ maxWidth: 480 }}>

        {/* Header */}
        <div className="mb-8 text-center">
          <span className={cx(badge.blue, "mb-4 inline-block")}>Gridbox</span>
          <h1 className="text-2xl font-bold text-slate-900">Uitnodiging activeren</h1>
        </div>

        {/* Loading */}
        {loading && (
          <div className={card.panel}>
            <p className={typography.body}>Uitnodiging wordt gecontroleerd&hellip;</p>
          </div>
        )}

        {/* Error bij laden */}
        {!loading && errorMessage && (
          <div className={alert.amber}>
            <p className="font-semibold mb-1">Uitnodiging niet geldig</p>
            <p>{errorMessage}</p>
          </div>
        )}

        {/* Afgerond scherm */}
        {done && (
          <div className={cx(card.base, "p-8 text-center")}>
            <div className="text-4xl mb-4">✓</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Activatie gelukt</h2>
            <p className={cx(typography.body, "mb-6")}>
              Je account is gereed. Je kunt nu naar het portaal.
            </p>
            <Link href="/" className={button.primary + " inline-block"}>
              Ga naar portaal
            </Link>
          </div>
        )}

        {/* Wizard */}
        {!loading && !errorMessage && invite?.valid && !done && (
          <div className="space-y-4">

            {/* Stap 1: Uitnodigingsinfo */}
            <div className={card.base}>
              <div className={card.header}>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
                  Stap 1 — Jouw uitnodiging
                </p>
                <h2 className="text-lg font-bold text-slate-900">
                  {invite.displayName || invite.email || "Welkom"}
                </h2>
              </div>
              <div className="px-6 py-5 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">E-mailadres</span>
                  <span className="font-medium text-slate-900">{invite.email || "-"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Rol</span>
                  <span className="font-medium text-slate-900">{roleLabel(invite.role)}</span>
                </div>
                {invite.customerId && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Bedrijf</span>
                    <span className="font-medium text-slate-900">{invite.customerId}</span>
                  </div>
                )}
              </div>

              {/* Login blok */}
              <div className="border-t border-slate-200 px-6 py-5">
                {authState.loading && (
                  <p className={typography.body}>Aanmeldstatus controleren&hellip;</p>
                )}

                {!authState.loading && !authState.uid && (
                  <div className="space-y-3">
                    <p className={typography.body}>
                      Log in met het uitgenodigde e-mailadres om verder te gaan.
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleGoogleLogin()}
                      className={button.primary + " w-full"}
                    >
                      Aanmelden met Google
                    </button>
                  </div>
                )}

                {!authState.loading && authState.uid && !emailMatches && (
                  <div className="space-y-3">
                    <div className={alert.amber}>
                      <p className="font-semibold mb-1">Verkeerd account</p>
                      <p>
                        Je bent ingelogd als <strong>{authState.email}</strong>, maar de uitnodiging
                        is voor <strong>{invite.email}</strong>.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      className={button.secondary + " w-full"}
                    >
                      Ander account gebruiken
                    </button>
                  </div>
                )}

                {!authState.loading && emailMatches && (
                  <div className={alert.green}>
                    Ingelogd als <strong>{authState.email}</strong>. Je kunt doorgaan.
                  </div>
                )}
              </div>
            </div>

            {/* Stap 2: Gsm-verificatie — alleen zichtbaar als email matched */}
            {emailMatches && (
              <div className={card.base}>
                <div className={card.header}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
                    Stap 2 — Gsm-verificatie
                  </p>
                  <h2 className="text-lg font-bold text-slate-900">
                    {phoneCodeSent ? "Voer de ontvangen code in" : "Vul je gsm-nummer in"}
                  </h2>
                </div>
                <div className="px-6 py-5 space-y-4">

                  {!phoneCodeSent && (
                    <>
                      <p className={typography.body}>
                        Je ontvangt een eenmalige code via sms om je identiteit te bevestigen.
                      </p>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+32475123456"
                        className={input.base}
                      />
                      <button
                        type="button"
                        onClick={() => void handleSendCode()}
                        disabled={busy}
                        className={button.primary + " w-full"}
                      >
                        {busy ? "Code versturen\u2026" : "Verificatiecode versturen"}
                      </button>
                    </>
                  )}

                  {phoneCodeSent && (
                    <>
                      <p className={typography.body}>
                        Voer de 6-cijferige code in die je op <strong>{phoneNumber}</strong> hebt
                        ontvangen.
                      </p>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={phoneCode}
                        onChange={(e) => setPhoneCode(e.target.value)}
                        placeholder="123456"
                        className={input.base}
                      />
                      <button
                        type="button"
                        onClick={() => void handleVerifyAndAccept()}
                        disabled={busy}
                        className={button.primary + " w-full"}
                      >
                        {busy ? "Bezig met activeren\u2026" : "Code bevestigen"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPhoneCodeSent(false); setPhoneCode(""); setStepError(""); }}
                        className={cx(button.secondary, "w-full")}
                      >
                        Ander nummer gebruiken
                      </button>
                    </>
                  )}

                  {stepError && (
                    <div className={alert.amber}>
                      {stepError}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <p className="text-slate-500 text-sm">Pagina laden&hellip;</p>
        </div>
      }
    >
      <PageContentRouter />
    </Suspense>
  );
}
