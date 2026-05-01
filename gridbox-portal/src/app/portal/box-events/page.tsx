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

function getSeverityClasses(severity: string, label: string) {
  if (severity === "error" || label.toLowerCase() === "fout")
    return "bg-red-50 border border-red-200 text-red-800";
  if (severity === "warning" || label.toLowerCase() === "waarschuwing")
    return "bg-amber-50 border border-amber-200 text-amber-800";
  return "bg-emerald-50 border border-emerald-300 text-emerald-800";
}

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
      const res = await fetch(apiUrl(`/portal/boxes/${boxId}/events`), {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store"
      });
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
    <main className="min-h-screen bg-slate-50 p-5 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-5">

        {/* Header */}
        <header className="bg-white border border-slate-200 rounded-3xl shadow-sm px-6 py-5">
          <h1 className="text-3xl font-bold text-slate-900">Box Historiek</h1>
          <p className="text-sm text-slate-600 font-semibold mt-1">🆔 Hardware ID: {boxId || "Onbekend"}</p>
        </header>

        {/* Navigatiebalk */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-3 flex flex-wrap gap-3 items-center w-fit">
          {boxId ? (
            <Link
              href={`/portal/box?id=${encodeURIComponent(boxId)}`}
              className="rounded-xl bg-slate-900 text-white px-5 py-3 text-sm font-semibold hover:bg-slate-800 transition-colors no-underline"
            >
              ← Terug naar cockpit
            </Link>
          ) : (
            <Link
              href="/"
              className="rounded-xl bg-slate-900 text-white px-5 py-3 text-sm font-semibold hover:bg-slate-800 transition-colors no-underline"
            >
              ← Home
            </Link>
          )}
          <div className="w-px h-7 bg-slate-200 mx-1" />
          <button
            type="button"
            onClick={() => { void loadEvents(); notify("Logboek ververst"); }}
            className="rounded-xl border border-slate-200 bg-white text-slate-900 px-5 py-3 text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            🔄 Ververs data
          </button>
        </div>

        {/* Laden */}
        {loading && (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-10 flex justify-center">
            <div className="loader" />
          </div>
        )}

        {/* Tabel */}
        {!loading && (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden overflow-x-auto">
            {events.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-slate-500 font-semibold">
                Geen gebeurtenissen gevonden.
              </p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {["Tijdstip", "Actie", "Bron / Gebruiker", "Status", "Foto archief"].map((col, i) => (
                      <th
                        key={col}
                        className={`px-5 py-4 border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 whitespace-nowrap ${i === 4 ? "text-center" : "text-left"}`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events.map((item) => {
                    const statusLabel = getStatusLabel(item);
                    return (
                      <React.Fragment key={item.id}>
                        <tr className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-4 text-sm text-slate-600 border-b border-slate-200 whitespace-nowrap">
                            {formatTimestamp(item.timestamp)}
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold text-slate-900 border-b border-slate-200 whitespace-nowrap">
                            {getActionLabel(item)}
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-600 border-b border-slate-200 whitespace-nowrap">
                            {getSourceLabel(item)}
                          </td>
                          <td className="px-5 py-4 border-b border-slate-200 whitespace-nowrap">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getSeverityClasses(item.severity, statusLabel)}`}>
                              {statusLabel.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-5 py-4 border-b border-slate-200 text-center whitespace-nowrap">
                            {item.hasPhotos ? (
                              <button
                                type="button"
                                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                                className={`rounded-xl px-3 py-1.5 text-lg border transition-colors ${
                                  expandedId === item.id
                                    ? "bg-slate-100 border-slate-200"
                                    : "bg-transparent border-transparent hover:bg-slate-50"
                                }`}
                              >
                                📸
                              </button>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                        {expandedId === item.id && item.photos && (
                          <tr>
                            <td colSpan={5} className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                              <div className="flex gap-4 overflow-x-auto pb-2">
                                {item.photos.map((photo, idx) => {
                                  const fullImageUrl = apiUrl(`/portal/boxes/${boxId}/photos/content?filename=${photo.filename}`);
                                  return (
                                    <div
                                      key={photo.id || idx}
                                      onClick={() => setSelectedImage(fullImageUrl)}
                                      className="w-24 h-40 rounded-xl cursor-zoom-in border-2 border-white shadow-sm flex-shrink-0 overflow-hidden relative"
                                    >
                                      <img
                                        src={fullImageUrl}
                                        alt="Opname"
                                        style={{
                                          position: "absolute",
                                          top: "50%",
                                          left: "50%",
                                          width: "177.78%",
                                          height: "56.25%",
                                          transform: "translate(-50%, -50%) rotate(90deg)",
                                          objectFit: "cover",
                                        }}
                                      />
                                    </div>
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

        {/* Footer */}
        <footer className="pt-2 pb-4">
          <Link href="/" className="text-sm text-slate-500 font-semibold hover:text-slate-900 transition-colors no-underline">
            ← Terug naar overzicht
          </Link>
        </footer>

      </div>

      {/* Lightbox */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center z-50 cursor-zoom-out"
        >
          <img
            src={selectedImage}
            alt="Vergroot beeld"
            className="rounded-2xl border-4 border-white"
            style={{ maxHeight: "85vw", maxWidth: "85vh", transform: "rotate(90deg)" }}
          />
          <p className="text-white mt-4 text-sm font-semibold">Klik ergens om te sluiten</p>
        </div>
      )}

      {/* Toast */}
      {toast.visible && (
        <div className="fixed right-6 bottom-6 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-xl text-sm font-semibold z-50 flex items-center gap-3" style={{ animation: "toastUp 0.5s ease" }}>
          <span className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-xs">✓</span>
          {toast.msg}
        </div>
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Historiek laden...</p>
      </main>
    }>
      <PageContentRouter />
    </Suspense>
  );
}
