"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { apiUrl } from "@/lib/api";
import AuthPanel from "@/components/AuthPanel";

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
};

function normalizeEmail(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function isValidPhone(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value.trim());
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
  });

  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneCode, setPhoneCode] = useState("");

  const [sendingCode, setSendingCode] = useState(false);
  const [sendCodeMessage, setSendCodeMessage] = useState("");
  const [sendCodeError, setSendCodeError] = useState("");

  const [verifyingCode, setVerifyingCode] = useState(false);
  const [verifyCodeMessage, setVerifyCodeMessage] = useState("");
  const [verifyCodeError, setVerifyCodeError] = useState("");

  const [accepting, setAccepting] = useState(false);
  const [acceptMessage, setAcceptMessage] = useState("");
  const [acceptError, setAcceptError] = useState("");

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setAuthState({
        loading: false,
        email: user?.email || "",
        uid: user?.uid || "",
      });
    });

    return () => unsubscribe();
  }, []);

  async function loadInviteValidation(currentToken: string) {
    const res = await fetch(apiUrl("/invites/validate"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: currentToken }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Kon uitnodiging niet valideren");
    }

    setInvite(data);

    if (data.phoneNumber) {
      setPhoneNumber(data.phoneNumber);
    }

    return data;
  }

  useEffect(() => {
    async function validateInvite() {
      try {
        setLoading(true);
        setErrorMessage("");
        setInvite(null);

        if (!token) {
          setErrorMessage("Geen invite-token gevonden in de link");
          return;
        }

        await loadInviteValidation(token);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Netwerkfout bij valideren van de uitnodiging";
        setErrorMessage(message);
      } finally {
        setLoading(false);
      }
    }

    void validateInvite();
  }, [token]);

  async function handleSendPhoneCode() {
    try {
      setSendingCode(true);
      setSendCodeMessage("");
      setSendCodeError("");
      setVerifyCodeMessage("");
      setVerifyCodeError("");
      setAcceptMessage("");
      setAcceptError("");

      if (!phoneNumber.trim()) {
        setSendCodeError("Vul een gsm-nummer in");
        return;
      }

      if (!isValidPhone(phoneNumber)) {
        setSendCodeError("Vul een geldig gsm-nummer in in internationaal formaat");
        return;
      }

      const res = await fetch(apiUrl("/invites/send-phone-code"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          phoneNumber: phoneNumber.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSendCodeError(data.message || data.error || "Kon verificatiecode niet versturen");
        return;
      }

      setSendCodeMessage(data.message || "Verificatiecode verzonden");
      await loadInviteValidation(token);
    } catch (error) {
      setSendCodeError("Netwerkfout bij versturen van de verificatiecode");
    } finally {
      setSendingCode(false);
    }
  }

  async function handleVerifyPhoneCode() {
    try {
      setVerifyingCode(true);
      setVerifyCodeMessage("");
      setVerifyCodeError("");
      setAcceptMessage("");
      setAcceptError("");

      if (!phoneCode.trim()) {
        setVerifyCodeError("Vul de verificatiecode in");
        return;
      }

      const res = await fetch(apiUrl("/invites/verify-phone-code"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          code: phoneCode.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setVerifyCodeError(data.message || data.error || "Kon verificatiecode niet controleren");
        return;
      }

      setVerifyCodeMessage(data.message || "Gsm-nummer geverifieerd");
      setPhoneCode("");
      await loadInviteValidation(token);
    } catch (error) {
      setVerifyCodeError("Netwerkfout bij controleren van de verificatiecode");
    } finally {
      setVerifyingCode(false);
    }
  }

  async function handleAcceptInvite() {
    try {
      setAccepting(true);
      setAcceptMessage("");
      setAcceptError("");

      const user = auth.currentUser;

      if (!user) {
        setAcceptError("Je bent niet aangemeld");
        return;
      }

      const idToken = await user.getIdToken();

      const res = await fetch(apiUrl("/invites/accept"), {
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

      const data = await res.json();

      if (!res.ok) {
        setAcceptError(data.message || data.error || "Activatie mislukt");
        return;
      }

      setAcceptMessage("Activatie gelukt. Deze uitnodiging is nu afgewerkt.");
      setInvite((current) =>
        current
          ? {
              ...current,
              status: "accepted",
            }
          : current
      );
    } catch (error) {
      setAcceptError("Netwerkfout bij activatie");
    } finally {
      setAccepting(false);
    }
  }

  const inviteEmail = normalizeEmail(invite?.email);
  const loggedInEmail = normalizeEmail(authState.email);
  const emailMatches = inviteEmail && loggedInEmail && inviteEmail === loggedInEmail;

  const canUsePhoneFlow =
    !!invite?.valid &&
    !!authState.uid &&
    !!emailMatches &&
    invite?.status !== "accepted" &&
    invite?.phoneVerified !== true;

  const canAttemptAccept =
    !!invite?.valid &&
    !!authState.uid &&
    !!emailMatches &&
    invite?.status !== "accepted" &&
    invite?.phoneVerified === true;

  return (
    <main style={{ padding: "24px", fontFamily: "sans-serif", maxWidth: "760px" }}>
      <h1>Uitnodiging activeren</h1>

      {loading && <p>Uitnodiging controleren...</p>}

      {!loading && errorMessage && (
        <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "16px" }}>
          <p style={{ color: "red", marginTop: 0 }}>{errorMessage}</p>
          <p style={{ marginBottom: 0 }}>
            Controleer of je de juiste link gebruikt of vraag een nieuwe uitnodiging aan.
          </p>
        </div>
      )}

      {!loading && invite?.valid && (
        <>
          <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "16px" }}>
            <p><strong>Status:</strong> {invite.status === "accepted" ? "uitnodiging afgewerkt" : "uitnodiging geldig"}</p>
            <p><strong>Email:</strong> {invite.email || "-"}</p>
            <p><strong>Naam:</strong> {invite.displayName || "-"}</p>
            <p><strong>Customer:</strong> {invite.customerId || "-"}</p>
            <p><strong>Rol:</strong> {invite.role || "-"}</p>
            <p><strong>Permissions:</strong> {invite.scope?.permissions?.length ? invite.scope.permissions.join(", ") : "-"}</p>
            <p><strong>Geldig tot:</strong> {invite.expiresAt || "-"}</p>
            <p><strong>Phone verified:</strong> {invite.phoneVerified ? "ja" : "nee"}</p>
            <p><strong>Phone status:</strong> {invite.phoneVerificationStatus || "-"}</p>
            <p><strong>Gsm-nummer:</strong> {invite.phoneNumber || "-"}</p>
          </div>

          <AuthPanel />

          <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "16px", marginTop: "16px" }}>
            <h2 style={{ marginTop: 0 }}>Login-status</h2>

            {authState.loading && <p>Loginstatus controleren...</p>}

            {!authState.loading && !authState.uid && (
              <>
                <p style={{ color: "darkorange" }}>
                  Je bent nog niet ingelogd.
                </p>
                <p>
                  Log in met het uitgenodigde e-mailadres: <strong>{invite.email || "-"}</strong>
                </p>
              </>
            )}

            {!authState.loading && authState.uid && (
              <>
                <p><strong>Ingelogd als:</strong> {authState.email || "-"}</p>

                {!emailMatches && (
                  <p style={{ color: "red" }}>
                    Dit account komt niet overeen met het uitgenodigde e-mailadres.
                  </p>
                )}

                {emailMatches && (
                  <p style={{ color: "green" }}>
                    Dit account komt overeen met de uitnodiging.
                  </p>
                )}
              </>
            )}
          </div>

          {canUsePhoneFlow && (
            <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "16px", marginTop: "16px" }}>
              <h2 style={{ marginTop: 0 }}>Gsm-verificatie</h2>

              <p>
                Vul je gsm-nummer in in internationaal formaat, bijvoorbeeld <strong>+32475123456</strong>.
              </p>

              <p>
                <input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+32475123456"
                  style={{ width: "100%", padding: "8px", marginBottom: "8px" }}
                />
              </p>

              <button
                type="button"
                onClick={() => void handleSendPhoneCode()}
                disabled={sendingCode}
                style={{ padding: "8px 12px" }}
              >
                {sendingCode ? "Code verzenden..." : "Verificatiecode versturen"}
              </button>

              {sendCodeMessage && (
                <p style={{ color: "green", marginTop: "12px", marginBottom: 0 }}>
                  {sendCodeMessage}
                </p>
              )}

              {sendCodeError && (
                <p style={{ color: "red", marginTop: "12px", marginBottom: 0 }}>
                  {sendCodeError}
                </p>
              )}

              <div style={{ marginTop: "16px", borderTop: "1px solid #eee", paddingTop: "16px" }}>
                <p>
                  Heb je een code ontvangen? Vul ze hier in.
                </p>

                <p>
                  <input
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value)}
                    placeholder="6-cijferige code"
                    style={{ width: "100%", padding: "8px", marginBottom: "8px" }}
                  />
                </p>

                <button
                  type="button"
                  onClick={() => void handleVerifyPhoneCode()}
                  disabled={verifyingCode}
                  style={{ padding: "8px 12px" }}
                >
                  {verifyingCode ? "Code controleren..." : "Code bevestigen"}
                </button>

                {verifyCodeMessage && (
                  <p style={{ color: "green", marginTop: "12px", marginBottom: 0 }}>
                    {verifyCodeMessage}
                  </p>
                )}

                {verifyCodeError && (
                  <p style={{ color: "red", marginTop: "12px", marginBottom: 0 }}>
                    {verifyCodeError}
                  </p>
                )}
              </div>
            </div>
          )}

          {canAttemptAccept && (
            <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "16px", marginTop: "16px" }}>
              <h2 style={{ marginTop: 0 }}>Activatie</h2>

              <button
                type="button"
                onClick={() => void handleAcceptInvite()}
                disabled={accepting}
                style={{ padding: "8px 12px" }}
              >
                {accepting ? "Activatie bezig..." : "Activatie afronden"}
              </button>

              {acceptMessage && (
                <p style={{ color: "green", marginTop: "12px", marginBottom: 0 }}>
                  {acceptMessage}
                </p>
              )}

              {acceptError && (
                <p style={{ color: "red", marginTop: "12px", marginBottom: 0 }}>
                  {acceptError}
                </p>
              )}
            </div>
          )}

          {invite?.status === "accepted" && (
            <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "16px", marginTop: "16px" }}>
              <h2 style={{ marginTop: 0 }}>Afgerond</h2>
              <p style={{ marginBottom: 0 }}>
                Deze uitnodiging is al geactiveerd en kan niet opnieuw gebruikt worden.
              </p>
            </div>
          )}

          <div style={{ marginTop: "20px", borderTop: "1px solid #eee", paddingTop: "16px" }}>
            <p style={{ marginTop: 0 }}>
              Volgorde: login met het juiste e-mailadres, gsm-code ontvangen, code bevestigen, daarna activatie afronden.
            </p>
          </div>
        </>
      )}
    </main>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<main style={{ padding: "24px", fontFamily: "sans-serif" }}><p>Pagina laden...</p></main>}>
      <PageContentRouter />
    </Suspense>
  );
}
