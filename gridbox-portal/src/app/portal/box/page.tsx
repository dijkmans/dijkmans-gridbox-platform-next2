/**
 * ============================================================================
 * GRIDBOX PORTAL - LOGISTICS COCKPIT V11.0 (STAGED DELIVERY)
 * ============================================================================
 * Deze versie bevat de volledige "Staged Delivery" workflow:
 * 1. Admin zet nummer klaar (Status: Pending, GEEN SMS)
 * 2. Chauffeur activeert bij drop (Status: Active, SMS trigger)
 * 3. Volledige Live Monitoring en Smart Toggle integratie.
 * ============================================================================
 */
"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { apiUrl } from "@/lib/api";

// Onze slimme component voor de slotbediening
import SmartToggleButton from "@/components/SmartToggleButton";

// --- DESIGN SYSTEM ---
const THEME = {
  primary: "#0f172a",
  muted: "#64748b",
  success: "#10b981",
  warning: "#f59e0b", // Oranje voor 'Klaargezet'
  danger: "#ef4444",
  border: "#e2e8f0",
  surface: "#f8fafc",
};

const STYLES = {
  container: {
    padding: "48px 24px",
    maxWidth: "1100px",
    margin: "0 auto",
    fontFamily: "'Inter', sans-serif",
    color: THEME.primary,
    backgroundColor: "#fff",
    minHeight: "100vh"
  },
  buttonDock: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px",
    backgroundColor: "#f1f5f9",
    borderRadius: "20px",
    border: `1px solid ${THEME.border}`,
    marginBottom: "40px",
    width: "fit-content",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
    flexWrap: "wrap" as const
  },
  navButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "56px",
    minWidth: "160px",
    padding: "0 20px",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: "800",
    textDecoration: "none",
    color: THEME.primary,
    background: "#fff",
    border: `1px solid ${THEME.border}`,
    transition: "all 0.2s ease",
    cursor: "pointer"
  },
  panelCard: {
    marginBottom: "40px",
    padding: "32px",
    borderRadius: "24px",
    backgroundColor: "#fff",
    border: `1px solid ${THEME.border}`,
    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)",
    animation: "slideIn 0.3s ease-out"
  },
  inputField: {
    padding: "16px 20px",
    minHeight: "56px",
    borderRadius: "12px",
    border: `1px solid ${THEME.border}`,
    fontSize: "16px",
    outline: "none",
    width: "100%",
    backgroundColor: THEME.surface,
    boxSizing: "border-box" as const
  },
  toast: {
    position: "fixed" as const,
    bottom: "40px",
    right: "40px",
    background: THEME.primary,
    color: "#fff",
    padding: "18px 32px",
    borderRadius: "24px",
    zIndex: 10000,
    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    gap: "15px",
    animation: "toastUp 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
  },
  cameraCanvas: {
    width: "100%",
    maxWidth: "900px",
    aspectRatio: "16/9",
    background: "#000",
    borderRadius: "32px",
    overflow: "hidden",
    border: "10px solid #1e293b",
    boxShadow: "0 30px 60px -12px rgba(0,0,0,0.3)",
    position: "relative" as const
  }
};

function PageContentRouter() {
  const searchParams = useSearchParams();
  const boxId = searchParams.get("id") || "";

  const [box, setBox] = useState<any>(null);
  const [shares, setShares] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [refreshKey, setRefreshKey] = useState(Date.now());
  const [toast, setToast] = useState({ visible: false, msg: "" });

  const [sharesOpen, setSharesOpen] = useState(searchParams.get("tab") === "toegang");

  const [sharePhone, setSharePhone] = useState("+32");
  const [shareLabel, setShareLabel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const notify = useCallback((msg: string) => {
    setToast({ visible: true, msg });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 5000);
  }, []);

  const loadDashboardData = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user || !boxId) return;
      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [resBox, resShares] = await Promise.all([
        fetch(apiUrl(`/portal/boxes/${boxId}?t=${Date.now()}`), { headers, cache: "no-store" }),
        fetch(apiUrl(`/portal/boxes/${boxId}/shares`), { headers, cache: "no-store" })
      ]);

      if (resBox.ok) setBox(await resBox.json());
      if (resShares.ok) {
        const d = await resShares.json();
        setShares(d.items || []);
      }
    } catch (e) {
      console.error("[Dashboard Load Error]", e);
    } finally {
      setLoading(false);
    }
  }, [boxId]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (u) void loadDashboardData();
    });

    void loadDashboardData();

    return () => unsubscribe();
  }, [loadDashboardData]);

  useEffect(() => {
    if (!boxId) return;

    const intervalId = window.setInterval(() => {
      void loadDashboardData();
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [boxId, loadDashboardData]);

  // Real-time camera update trigger via Firestore snapshots
  useEffect(() => {
    if (!boxId) return;
    const q = query(collection(db, "boxes", boxId, "snapshots"), orderBy("capturedAt", "desc"), limit(1));
    return onSnapshot(q, () => setRefreshKey(Date.now()));
  }, [boxId]);

  /**
   * STAP 1: Toegang aanmaken (Admin stap)
   * Hier sturen we expliciet de status "pending" of "active" mee.
   */
  const handleCreateShare = async (isPending: boolean) => {
    if (!sharePhone.trim() || sharePhone === "+32") { notify("Vul a.u.b. een gsm-nummer in."); return; }
    try {
      setIsSubmitting(true);
      const token = await auth.currentUser?.getIdToken();
      
      const res = await fetch(apiUrl(`/portal/boxes/${boxId}/shares`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          phoneNumber: sharePhone, 
          label: shareLabel,
          status: isPending ? "pending" : "active" // CRUCIAAL: Voorkomt te vroege SMS
        })
      });

      if (res.ok) {
        setSharePhone("+32"); setShareLabel(""); 
        notify(isPending ? "Klaargezet voor chauffeur! 📦" : "Toegang direct gedeeld! 🚀");
        void loadDashboardData();
      } else {
        notify("Fout bij aanmaken share.");
      }
    } catch {
      notify("Netwerkfout.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * STAP 2: Activeren door chauffeur (SMS trigger)
   * Wordt aangeroepen via de enveloppe-knop
   */
  const handleActivateShare = async (shareId: string) => {
    if (!window.confirm("Pakket geleverd? Verstuur nu de SMS naar de klant.")) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const encodedId = encodeURIComponent(shareId);
      const res = await fetch(apiUrl(`/portal/boxes/${boxId}/shares/${encodedId}/activate`), {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        notify("SMS succesvol verstuurd! ✉️");
        void loadDashboardData();
      } else {
        notify("Fout bij activeren.");
      }
    } catch {
      notify("Netwerkfout.");
    }
  };

  const handleDeleteShare = async (shareId: string) => {
    const isConfirmed = window.confirm(`Toegang voor ${shareId} definitief intrekken?`);
    if (!isConfirmed) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const encodedShareId = encodeURIComponent(shareId);
      const res = await fetch(apiUrl(`/portal/boxes/${boxId}/shares/${encodedShareId}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        notify("Toegang definitief ingetrokken! 🗑️");
        void loadDashboardData();
      } else {
        notify("Fout bij verwijderen.");
      }
    } catch {
      notify("Netwerkfout.");
    }
  };

  if (loading) return <main style={STYLES.container}><p>Cockpit laden...</p></main>;

  return (
    <main style={STYLES.container}>
      <header style={{ marginBottom: "40px" }}>
        <div style={{ marginBottom: "16px" }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "10px",
              border: `1px solid ${THEME.border}`,
              background: "#fff",
              color: THEME.muted,
              fontSize: "13px",
              fontWeight: "600",
              textDecoration: "none",
            }}
          >
            ← Terug naar overzicht
          </Link>
        </div>
        <h1 style={{ fontSize: "2.8rem", fontWeight: "900", letterSpacing: "-1.5px", color: THEME.primary }}>
          {box?.displayName}
        </h1>
        <div style={{ display: "flex", gap: "20px", color: THEME.muted, fontSize: "14px", fontWeight: "600" }}>
           <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
             <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: box?.status === "online" ? THEME.success : THEME.danger }}></span>
             {box?.status?.toUpperCase() || "ONBEKEND"}
           </span>
           <span>📍 {box?.siteName}</span>
           <span>🆔 {boxId}</span>
        </div>
      </header>

      {/* ACTIEBALK */}
      <div style={STYLES.buttonDock}>
        <SmartToggleButton
          boxId={boxId}
          boxName={box?.displayName}
          isOpen={box?.boxIsOpen === true}
          canInteract={(box?.availableActions?.open || false) || (box?.availableActions?.close || false)}
          onNotify={notify}
          onActionComplete={loadDashboardData}
        />
        <div style={{ width: "2px", height: "30px", background: THEME.border, margin: "0 10px" }}></div>
        <Link href={`/portal/box-events?id=${boxId}`} style={STYLES.navButton}>📋 HISTORIEK</Link>
        <button
          onClick={() => setSharesOpen(!sharesOpen)}
          style={{ ...STYLES.navButton, background: sharesOpen ? THEME.primary : "#fff", color: sharesOpen ? "#fff" : THEME.primary }}
        >
          👥 TOEGANG BEHEREN
        </button>
        <button onClick={() => { void loadDashboardData(); notify("Dashboard ververst!"); }} style={{ background: "none", border: "none", cursor: "pointer", padding: "0 15px", fontSize: "20px" }}>🔄</button>
      </div>

      {/* LOGISTIEKE WORKFLOW PANEEL */}
      {sharesOpen && (
        <section style={STYLES.panelCard}>
          <h2 style={{ marginTop: 0, fontSize: "22px", fontWeight: "800" }}>Logistieke Workflow</h2>
          <p style={{ color: THEME.muted, marginBottom: "25px" }}>Zet een nummer klaar voor de chauffeur, of deel direct de toegang.</p>

          <div className="share-grid">
            <input type="tel" style={STYLES.inputField} value={sharePhone} onChange={e => setSharePhone(e.target.value)} placeholder="Gsm nummer (bijv. +32...)" />
            <input type="text" style={STYLES.inputField} value={shareLabel} onChange={e => setShareLabel(e.target.value)} placeholder="Naam / Pakket-ID" />
            
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => handleCreateShare(true)} // Klaarzetten
                disabled={isSubmitting}
                style={{ ...STYLES.navButton, background: "#f1f5f9", border: `1px solid ${THEME.border}`, flex: 1 }}
              >
                KLAARZETTEN
              </button>
              <button
                onClick={() => handleCreateShare(false)} // Direct
                disabled={isSubmitting}
                style={{ ...STYLES.navButton, background: THEME.primary, color: "#fff", border: "none", flex: 1 }}
              >
                DIRECT DELEN
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gap: "12px" }}>
            {shares.length === 0 ? (
              <p style={{ color: THEME.muted }}>Geen actieve shares voor deze kluis.</p>
            ) : shares.map(s => (
              <div key={s.id} style={{ padding: "16px", borderRadius: "12px", border: `1px solid ${THEME.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: THEME.surface }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontWeight: "800", fontSize: "15px" }}>{s.id}</span>
                  <span style={{ color: THEME.muted, fontSize: "13px" }}>{s.label || "Geen label"}</span>
                </div>
                
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {/* STATUS LABEL */}
                  <span style={{ 
                    fontSize: "10px", fontWeight: "900", padding: "6px 12px", borderRadius: "8px",
                    background: s.active ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
                    color: s.active ? THEME.success : THEME.warning
                  }}>
                    {s.active ? "ACTIEF" : "KLAARGEZET"}
                  </span>
                  
                  {/* CHAUFFEUR ACTIVATIE KNOP (Subtiel Lichtblauw met Donkerblauw Icoon) */}
                  {!s.active && (
                    <button 
                      onClick={() => handleActivateShare(s.id)}
                      style={{ background: "#e0e7ff", border: "none", borderRadius: "8px", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "0.2s" }}
                      title="SMS nu versturen"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3730a3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="20" height="16" x="2" y="4" rx="2"/>
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                      </svg>
                    </button>
                  )}

                  {/* VERWIJDER KNOP (Subtiel Lichtrood met Donkerrood Icoon) */}
                  <button 
                    onClick={() => handleDeleteShare(s.id)}
                    style={{ background: "#fee2e2", border: "none", borderRadius: "8px", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "0.2s" }}
                    title="Toegang intrekken"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"/>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* LIVE MONITORING SECTIE */}
      <section style={{ paddingTop: "20px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "800", marginBottom: "25px", display: "flex", alignItems: "center", gap: "12px" }}>
          <span className="live-dot"></span> LIVE MONITORING
        </h3>
        <div style={STYLES.cameraCanvas}>
          <img
            src={apiUrl(`/portal/boxes/${boxId}/picture?t=${refreshKey}`)}
            alt="Real-time Feed"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div style={{ position: "absolute", top: "25px", right: "25px", color: "#00ff41", fontFamily: "monospace", fontWeight: "bold", fontSize: "11px", border: "1px solid #00ff41", padding: "4px 10px", borderRadius: "8px", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
             STREAM_OK // 1080p
          </div>
        </div>
      </section>

      {/* NOTIFICATIE TOAST */}
      {toast.visible && (
        <div style={STYLES.toast}>
          <div style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: THEME.success, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>✓</div>
          <span style={{ fontWeight: "700", fontSize: "14px" }}>{toast.msg}</span>
        </div>
      )}

      <footer style={{ marginTop: "100px", paddingBottom: "40px" }} />

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        .share-grid { display: grid; grid-template-columns: 1fr; gap: 15px; margin-bottom: 30px; }
        @media (min-width: 768px) { .share-grid { grid-template-columns: 1fr 1fr 1fr; } }
        .live-dot { width: 12px; height: 12px; background: #ef4444; border-radius: 50%; animation: pulseRing 1.5s infinite; }
        @keyframes pulseRing { 0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
        @keyframes toastUp { from { transform: translateY(100px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        button:hover { transform: translateY(-2px); transition: 0.2s; filter: brightness(1.05); }
        button:active { transform: translateY(0); }
      `}</style>
    </main>
  );
}

export default function BoxDetailPage() {
  return (
    <Suspense fallback={<main style={{ padding: "80px", textAlign: "center" }}><div className="loader"></div></main>}>
      <PageContentRouter />
      <style jsx>{`
        .loader { width: 30px; height: 30px; border: 3px solid #f3f3f3; border-top: 3px solid #0f172a; border-radius: 50%; display: inline-block; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </Suspense>
  );
}
