/**
 * ============================================================================
 * GRIDBOX PORTAL - PREMIUM HISTORIEK (V9.1 - MOBILE FIX)
 * ============================================================================
 * Toegevoegd: Horizontaal scrollen (swipen) voor tabellen op smartphones.
 * ============================================================================
 */

"use client";

import React, { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { apiUrl } from "@/lib/api";

type PortalEventItem = {
  id: string;
  type: string;
  timestamp: string;
  label: string;
  severity: "info" | "warning" | "error";
  hasPhotos?: boolean;
  photos?: { id: string; filename: string; capturedAt: string }[];
};

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("nl-BE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).format(date);
}

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getActionLabel(item: PortalEventItem) {
  if (item.type.startsWith("command_")) return capitalize(item.type.replace("command_", "").toLowerCase());
  if (item.type === "heartbeat") return "Heartbeat";
  if (item.type === "relay_open") return "Relais open";
  return capitalize(item.type.replaceAll("_", " ").toLowerCase());
}

function getSourceLabel(item: PortalEventItem) {
  const viaMatch = item.label.match(/ via (.+?) \(/i);
  if (viaMatch && viaMatch[1]) return viaMatch[1].trim();
  if (item.type.startsWith("command_")) return "Onbekend";
  return "Systeem";
}

function getStatusLabel(item: PortalEventItem) {
  const statusMatch = item.label.match(/\((.+?)\)$/);
  if (statusMatch && statusMatch[1]) return capitalize(statusMatch[1].trim().toLowerCase());
  if (item.severity === "error") return "Fout";
  if (item.severity === "warning") return "Waarschuwing";
  return "Info";
}

function getSeverityStyle(severity: string, label: string) {
  if (severity === "error" || label.toLowerCase() === "fout") return { bg: "rgba(239, 68, 68, 0.1)", color: "#ef4444" };
  if (severity === "warning" || label.toLowerCase() === "waarschuwing") return { bg: "rgba(245, 158, 11, 0.1)", color: "#f59e0b" };
  return { bg: "rgba(16, 185, 129, 0.1)", color: "#10b981" };
}

const THEME = {
  primary: "#0f172a", muted: "#64748b", success: "#10b981", danger: "#ef4444", border: "#e2e8f0", surface: "#f8fafc",
};

const STYLES = {
  container: { padding: "48px 24px", maxWidth: "1100px", margin: "0 auto", fontFamily: "'Inter', sans-serif", color: THEME.primary, backgroundColor: "#fff", minHeight: "100vh" },
  buttonDock: { display: "flex", alignItems: "center", gap: "12px", padding: "10px", backgroundColor: THEME.surface, borderRadius: "20px", border: `1px solid ${THEME.border}`, marginBottom: "40px", width: "fit-content", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", flexWrap: "wrap" as const },
  navButton: { display: "flex", alignItems: "center", justifyContent: "center", height: "48px", minWidth: "160px", padding: "0 20px", borderRadius: "12px", fontSize: "13px", fontWeight: "700", textDecoration: "none", color: THEME.primary, background: "#fff", border: `1px solid ${THEME.border}`, transition: "all 0.2s ease", cursor: "pointer" },
  
  // HIER ZIT DE MOBILE FIX:
  tableContainer: {
    border: `1px solid ${THEME.border}`,
    borderRadius: "20px",
    overflowX: "auto" as const, // Zorgt ervoor dat je kunt swipen op mobiel!
    WebkitOverflowScrolling: "touch" as const, // Maakt het swipen soepel op iPhones
    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)",
    backgroundColor: "#fff"
  },
  th: { textAlign: "left" as const, padding: "16px 20px", borderBottom: `2px solid ${THEME.border}`, backgroundColor: THEME.surface, color: THEME.muted, fontSize: "12px", fontWeight: "800", textTransform: "uppercase" as const, letterSpacing: "0.5px", whiteSpace: "nowrap" as const },
  td: { padding: "16px 20px", borderBottom: `1px solid ${THEME.border}`, fontSize: "14px", fontWeight: "500", whiteSpace: "nowrap" as const },
  toast: { position: "fixed" as const, bottom: "40px", right: "40px", background: THEME.primary, color: "#fff", padding: "18px 32px", borderRadius: "24px", zIndex: 10000, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)", display: "flex", alignItems: "center", gap: "15px", animation: "toastUp 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)" }
};

function PageContentRouter() {
  const searchParams = useSearchParams();
  const boxId = searchParams.get("id") || "";

  const [events, setEvents] = useState<PortalEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ visible: false, msg: "" });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const notify = useCallback((msg: string) => {
    setToast({ visible: true, msg });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 5000);
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user || !boxId) return;
      const token = await user.getIdToken();
      const res = await fetch(apiUrl(`/portal/boxes/${boxId}/events`), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await res.json();
      if (res.ok) setEvents(data.items || []);
      else notify(data.message || "Kon historiek niet ophalen.");
    } catch {
      notify("Netwerkfout bij ophalen historiek.");
    } finally {
      setLoading(false);
    }
  }, [boxId, notify]);

  useEffect(() => {
    let active = true;
    const unsubscribe = auth.onAuthStateChanged(async () => { if (active) await loadEvents(); });
    void loadEvents();
    return () => { active = false; unsubscribe(); };
  }, [loadEvents]);

  return (
    <main style={STYLES.container}>
      <header style={{ marginBottom: "40px" }}>
        <h1 style={{ fontSize: "2.8rem", fontWeight: "900", letterSpacing: "-1.5px" }}>Box Historiek</h1>
        <p style={{ color: THEME.muted, fontWeight: "600", fontSize: "15px" }}>🆔 Hardware ID: {boxId || "Onbekend"}</p>
      </header>

      <div style={STYLES.buttonDock}>
        {boxId ? (
          <Link href={`/portal/box?id=${encodeURIComponent(boxId)}`} style={{ ...STYLES.navButton, background: THEME.primary, color: "#fff", border: "none" }}>← TERUG NAAR COCKPIT</Link>
        ) : (
          <Link href="/" style={{ ...STYLES.navButton, background: THEME.primary, color: "#fff", border: "none" }}>← HOME</Link>
        )}
        <div style={{ width: "2px", height: "30px", background: THEME.border, margin: "0 10px" }}></div>
        <button type="button" onClick={() => { void loadEvents(); notify("Logboek ververst"); }} style={STYLES.navButton}>🔄 VERVERS DATA</button>
      </div>

      {loading && <div style={{ padding: "40px", textAlign: "center", color: THEME.muted }}><div className="loader"></div></div>}

      {!loading && (
        <div style={STYLES.tableContainer}>
          {events.length === 0 ? (
            <p style={{ padding: "40px", margin: 0, textAlign: "center", color: THEME.muted, fontWeight: "600" }}>Geen gebeurtenissen gevonden.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={STYLES.th}>Tijdstip</th>
                  <th style={STYLES.th}>Actie</th>
                  <th style={STYLES.th}>Bron / Gebruiker</th>
                  <th style={STYLES.th}>Status</th>
                  <th style={{ ...STYLES.th, textAlign: "center" }}>Foto Archief</th>
                </tr>
              </thead>
              <tbody>
                {events.map((item) => {
                  const statusLabel = getStatusLabel(item);
                  const badgeStyle = getSeverityStyle(item.severity, statusLabel);
                  return (
                    <React.Fragment key={item.id}>
                      <tr className="table-row-hover">
                        <td style={STYLES.td}>{formatTimestamp(item.timestamp)}</td>
                        <td style={{ ...STYLES.td, fontWeight: "700", color: THEME.primary }}>{getActionLabel(item)}</td>
                        <td style={STYLES.td}>{getSourceLabel(item)}</td>
                        <td style={STYLES.td}>
                          <span style={{ backgroundColor: badgeStyle.bg, color: badgeStyle.color, padding: "6px 12px", borderRadius: "8px", fontWeight: "800", fontSize: "12px" }}>
                            {statusLabel.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ ...STYLES.td, textAlign: "center" }}>
                          {item.hasPhotos ? (
                            <button
                              type="button"
                              onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                              className="photo-toggle-btn"
                              style={{ background: expandedId === item.id ? THEME.surface : "none", border: `1px solid ${expandedId === item.id ? THEME.border : "transparent"}`, fontSize: "20px", cursor: "pointer", padding: "6px 10px", borderRadius: "8px" }}
                            >
                              📸
                            </button>
                          ) : <span style={{ color: THEME.border }}>-</span>}
                        </td>
                      </tr>
                      {expandedId === item.id && item.photos && (
                        <tr>
                          <td colSpan={5} style={{ padding: "24px", backgroundColor: THEME.surface, borderBottom: `1px solid ${THEME.border}` }}>
                            <div style={{ display: "flex", gap: "16px", overflowX: "auto", paddingBottom: "10px" }}>
                              {item.photos.map((photo, idx) => {
                                 const fullImageUrl = apiUrl(`/portal/boxes/${boxId}/photos/content?filename=${photo.filename}`);
                                 return (
                                  <img key={photo.id || idx} src={fullImageUrl} alt="Opname" onClick={() => setSelectedImage(fullImageUrl)} style={{ width: "160px", height: "100px", objectFit: "cover", borderRadius: "12px", cursor: "zoom-in", border: "3px solid #fff", flexShrink: 0 }} />
                                 );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {selectedImage && (
        <div onClick={() => setSelectedImage(null)} style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(15, 23, 42, 0.9)", backdropFilter: "blur(5px)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", zIndex: 9999, cursor: "zoom-out" }}>
          <img src={selectedImage} alt="Vergroot beeld" style={{ maxWidth: "90%", maxHeight: "85vh", borderRadius: "16px", border: "4px solid #fff" }} />
          <p style={{ color: "#fff", marginTop: "20px", fontWeight: "700", fontSize: "14px" }}>Klik ergens om te sluiten</p>
        </div>
      )}

      {toast.visible && (
        <div style={STYLES.toast}>
          <div style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: THEME.success, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>✓</div>
          <span style={{ fontWeight: "700", fontSize: "14px" }}>{toast.msg}</span>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .table-row-hover:hover td { background-color: #f8fafc; }
        .photo-toggle-btn:hover { transform: scale(1.1); background-color: #f1f5f9 !important; }
        button:hover:not(.photo-toggle-btn) { filter: brightness(1.05); transform: translateY(-1px); }
        @keyframes toastUp { from { transform: translateY(100px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .loader { width: 36px; height: 36px; border: 4px solid #f1f5f9; border-top: 4px solid #0f172a; border-radius: 50%; display: inline-block; animation: spin 1s linear infinite; margin: 0 auto;}
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </main>
  );
}

export default function Page() {
  return <Suspense fallback={<main style={{ padding: "80px", textAlign: "center" }}><p>Historiek laden...</p></main>}><PageContentRouter /></Suspense>;
}