"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { apiUrl } from "@/lib/api";
import SmartToggleButton from "@/components/SmartToggleButton";

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
    const intervalId = window.setInterval(() => void loadDashboardData(), 3000);
    return () => window.clearInterval(intervalId);
  }, [boxId, loadDashboardData]);

  useEffect(() => {
    if (!boxId) return;
    const q = query(collection(db, "boxes", boxId, "snapshots"), orderBy("capturedAt", "desc"), limit(1));
    return onSnapshot(q, () => setRefreshKey(Date.now()));
  }, [boxId]);

  useEffect(() => {
    if (searchParams.get("tab") === "toegang") {
      document.getElementById("toegang")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [searchParams]);

  const handleCreateShare = async (isPending: boolean) => {
    if (!sharePhone.trim() || sharePhone === "+32") { notify("Vul a.u.b. een gsm-nummer in."); return; }
    try {
      setIsSubmitting(true);
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(apiUrl(`/portal/boxes/${boxId}/shares`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phoneNumber: sharePhone, label: shareLabel, status: isPending ? "pending" : "active" })
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

  const handleActivateShare = async (shareId: string) => {
    if (!window.confirm("Pakket geleverd? Verstuur nu de SMS naar de klant.")) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(apiUrl(`/portal/boxes/${boxId}/shares/${encodeURIComponent(shareId)}/activate`), {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) { notify("SMS succesvol verstuurd! ✉️"); void loadDashboardData(); }
      else notify("Fout bij activeren.");
    } catch { notify("Netwerkfout."); }
  };

  const handleDeleteShare = async (shareId: string) => {
    if (!window.confirm(`Toegang voor ${shareId} definitief intrekken?`)) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(apiUrl(`/portal/boxes/${boxId}/shares/${encodeURIComponent(shareId)}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) { notify("Toegang definitief ingetrokken! 🗑️"); void loadDashboardData(); }
      else notify("Fout bij verwijderen.");
    } catch { notify("Netwerkfout."); }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="loader" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-5 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-5">

        {/* Header */}
        <header className="bg-white border border-slate-200 rounded-3xl shadow-sm px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 leading-tight">{box?.displayName}</h1>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600 font-semibold">
                <span className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${box?.status === "online" ? "bg-emerald-500" : "bg-red-500"}`} />
                  {box?.status?.toUpperCase() || "ONBEKEND"}
                </span>
                <span>📍 {box?.siteName}</span>
                <span>🆔 {boxId}</span>
              </div>
            </div>
            <Link
              href="/"
              className="shrink-0 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-semibold px-4 py-2 hover:bg-slate-50 transition-colors no-underline"
            >
              ← Overzicht
            </Link>
          </div>
        </header>

        {/* Actiebalk */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-3 flex flex-wrap gap-3 items-center w-fit">
          <div className="min-w-[160px]">
            <SmartToggleButton
              boxId={boxId}
              boxName={box?.displayName}
              isOpen={box?.boxIsOpen === true}
              canInteract={(box?.availableActions?.open || false) || (box?.availableActions?.close || false)}
              onNotify={notify}
              onActionComplete={loadDashboardData}
            />
          </div>
          <div className="w-px h-7 bg-slate-200 mx-1" />
          <Link
            href={`/portal/box-events?id=${boxId}`}
            className="rounded-xl border border-slate-200 bg-white text-slate-900 px-5 py-3 text-sm font-semibold hover:bg-slate-50 transition-colors no-underline flex items-center gap-2"
          >
            📋 Historiek
          </Link>
          <button
            onClick={() => setSharesOpen(!sharesOpen)}
            className={`rounded-xl border px-5 py-3 text-sm font-semibold transition-colors flex items-center gap-2 ${
              sharesOpen
                ? "bg-slate-900 border-slate-900 text-white"
                : "bg-white border-slate-200 text-slate-900 hover:bg-slate-50"
            }`}
          >
            👥 Toegang beheren
          </button>
          <button
            onClick={() => { void loadDashboardData(); notify("Dashboard ververst!"); }}
            className="rounded-xl border border-slate-200 bg-white text-slate-900 px-4 py-3 text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            🔄
          </button>
        </div>

        {/* Logistieke Workflow paneel */}
        {sharesOpen && (
          <section id="toegang" className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 lg:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Logistieke Workflow</h2>
              <p className="text-sm text-slate-600 mt-1">Zet een nummer klaar voor de chauffeur, of deel direct de toegang.</p>
            </div>

            {/* Formulier */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <input
                type="tel"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                value={sharePhone}
                onChange={e => setSharePhone(e.target.value)}
                placeholder="Gsm nummer (bijv. +32...)"
              />
              <input
                type="text"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                value={shareLabel}
                onChange={e => setShareLabel(e.target.value)}
                placeholder="Naam / Pakket-ID"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleCreateShare(true)}
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 px-4 py-3 text-sm font-semibold hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  Klaarzetten
                </button>
                <button
                  onClick={() => handleCreateShare(false)}
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl bg-slate-900 text-white px-4 py-3 text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  Direct delen
                </button>
              </div>
            </div>

            {/* Shares lijst */}
            <div className="space-y-3">
              {shares.length === 0 ? (
                <p className="text-sm text-slate-500">Geen actieve shares voor deze kluis.</p>
              ) : shares.map(s => (
                <div key={s.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-base font-semibold text-slate-900">{s.id}</span>
                    <span className="text-sm text-slate-500">{s.label || "Geen label"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${
                      s.active
                        ? "bg-emerald-50 border border-emerald-300 text-emerald-800"
                        : "bg-amber-50 border border-amber-200 text-amber-800"
                    }`}>
                      {s.active ? "Actief" : "Klaargezet"}
                    </span>
                    {!s.active && (
                      <button
                        onClick={() => handleActivateShare(s.id)}
                        title="SMS nu versturen"
                        className="rounded-xl bg-blue-50 border border-blue-200 text-blue-700 w-10 h-10 flex items-center justify-center hover:bg-blue-100 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="20" height="16" x="2" y="4" rx="2"/>
                          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteShare(s.id)}
                      title="Toegang intrekken"
                      className="rounded-xl bg-red-50 border border-red-200 text-red-700 p-2 flex items-center justify-center hover:bg-red-100 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Live monitoring */}
        <section className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 lg:p-8">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 mb-4 flex items-center gap-2">
            <span className="live-dot" /> Live monitoring
          </h3>
          <div className="w-full max-w-3xl aspect-video bg-slate-900 rounded-2xl overflow-hidden border-4 border-slate-800 shadow-xl relative">
            <img
              src={apiUrl(`/portal/boxes/${boxId}/picture?t=${refreshKey}`)}
              alt="Real-time feed"
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 right-4 text-xs font-mono border border-emerald-400 text-emerald-400 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm">
              STREAM_OK // 1080p
            </div>
          </div>
        </section>


      </div>

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

export default function BoxDetailPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="loader" />
      </main>
    }>
      <PageContentRouter />
    </Suspense>
  );
}
