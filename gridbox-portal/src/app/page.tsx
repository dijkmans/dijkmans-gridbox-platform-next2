"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { signInWithPopup, signOut, User } from "firebase/auth";
import SmartToggleButton from "@/components/SmartToggleButton";
import { auth, googleProvider } from "@/lib/firebase";
import { apiUrl } from "@/lib/api";

type PortalBox = {
  id: string;
  displayName: string;
  siteId: string;
  siteName: string;
  status: "online" | "offline" | "warning" | "unknown";
  lastHeartbeat?: string;
  boxIsOpen: boolean;
  lastActionAt?: string;
  lastActionSource?: string;
  canOpen: boolean;
  shareSummary?: {
    totalActive: number;
    phoneNumbers: { number: string; comment: string | null; active: boolean }[];
  };
  links: {
    detail: string;
    history?: string;
  };
  occupancy?: "empty" | "occupied" | string;
};

type PortalBoxesResponse = {
  items: PortalBox[];
  count: number;
  mode: string;
  branding?: {
    footerText?: string;
  };
};

type SiteGroup = {
  siteId: string;
  siteName: string;
  boxes: PortalBox[];
};

function getStatusLabel(status: PortalBox["status"]) {
  if (status === "online") return "ONLINE";
  if (status === "offline") return "OFFLINE";
  if (status === "warning") return "WAARSCHUWING";
  return "ONBEKEND";
}

function getStatusClasses(status: PortalBox["status"]) {
  if (status === "online") return "rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold px-3 py-1";
  if (status === "offline") return "rounded-full bg-red-50 border border-red-200 text-red-800 text-xs font-semibold px-3 py-1";
  if (status === "warning") return "rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold px-3 py-1";
  return "rounded-full bg-slate-100 border border-slate-300 text-slate-600 text-xs font-semibold px-3 py-1";
}

function formatTimeAgo(value?: string) {
  if (!value) return "onbekend";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "onbekend";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return "zojuist";
  if (diffMinutes < 60) return `${diffMinutes} min geleden`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} uur geleden`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} dagen geleden`;
}

function formatActionSource(source?: string) {
  const normalized = source?.trim().toLowerCase();

  if (!normalized) return "onbekend";
  if (normalized === "web dashboard") return "web";
  if (normalized === "customer") return "klant";
  if (normalized === "employee") return "medewerker";

  return source!.trim();
}

function formatLastAction(box: PortalBox) {
  const timePart = formatTimeAgo(box.lastActionAt || box.lastHeartbeat);
  const statePart = box.boxIsOpen ? "open" : "dicht";
  const sourcePart = formatActionSource(box.lastActionSource);
  return `${timePart} \u2022 ${statePart} \u2022 ${sourcePart}`;
}

async function fetchProtectedAssetUrl(token: string, path: string): Promise<string | null> {
  const res = await fetch(apiUrl(path), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) return null;

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export default function Home() {
  const [selectedSiteId, setSelectedSiteId] = useState<string>("all");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("site");

    if (fromUrl) {
      setSelectedSiteId(fromUrl);
      localStorage.setItem("gridbox.selectedSite", fromUrl);
      return;
    }

    const stored = localStorage.getItem("gridbox.selectedSite");
    if (stored && stored !== "all") {
      setSelectedSiteId(stored);
      return;
    }

    setSelectedSiteId("all");
  }, []);

  function setSiteId(id: string) {
    setSelectedSiteId(id);
    if (typeof window === "undefined") return;
    if (id === "all") {
      localStorage.removeItem("gridbox.selectedSite");
    } else {
      localStorage.setItem("gridbox.selectedSite", id);
    }
    const url = new URL(window.location.href);
    if (id === "all") {
      url.searchParams.delete("site");
    } else {
      url.searchParams.set("site", id);
    }
    window.history.replaceState({}, "", url.toString());
  }

  const [user, setUser] = useState<User | null>(null);
  const [boxes, setBoxes] = useState<PortalBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const [footerText, setFooterText] = useState("Powered by Gridbox");
  const [gridboxLogoUrl, setGridboxLogoUrl] = useState<string | null>(null);
  const [customerLogoUrl, setCustomerLogoUrl] = useState<string | null>(null);
  const [footerLogoUrl, setFooterLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((nextUser) => {
      setUser(nextUser);
    });
    return () => unsubscribe();
  }, []);

  const loadBoxes = useCallback(async () => {
    try {
      if (!auth.currentUser) {
        setBoxes([]);
        setFooterText("Powered by Gridbox");
        setMessage("Meld je aan om boxen te bekijken");
        setLoading(false);
        return;
      }

      setLoading(true);
      setMessage("");

      const token = await auth.currentUser.getIdToken();

      const res = await fetch(apiUrl("/portal/boxes"), {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        setBoxes([]);
        setFooterText("Powered by Gridbox");
        setMessage(data.message || "Kon boxen niet ophalen");
        setLoading(false);
        return;
      }

      const typed = data as PortalBoxesResponse;
      setBoxes(Array.isArray(typed.items) ? typed.items : []);
      setFooterText(typed.branding?.footerText || "Powered by Gridbox");
    } catch {
      setBoxes([]);
      setFooterText("Powered by Gridbox");
      setMessage("Netwerkfout bij ophalen van boxen");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let urlsToRevoke: string[] = [];

    async function loadBrandingAssets() {
      try {
        if (!user || !auth.currentUser) {
          setGridboxLogoUrl(null);
          setCustomerLogoUrl(null);
          setFooterLogoUrl(null);
          return;
        }

        const token = await auth.currentUser.getIdToken();

        const [gridboxUrl, customerUrl, footerUrl] = await Promise.all([
          fetchProtectedAssetUrl(token, "/portal/assets/gridbox-logo"),
          fetchProtectedAssetUrl(token, "/portal/assets/customer-logo"),
          fetchProtectedAssetUrl(token, "/portal/assets/gridbox-footer-logo"),
        ]);

        const uniqueUrls = Array.from(
          new Set([gridboxUrl, customerUrl, footerUrl].filter(Boolean) as string[])
        );

        if (!active) {
          uniqueUrls.forEach((url) => URL.revokeObjectURL(url));
          return;
        }

        urlsToRevoke = uniqueUrls;
        setGridboxLogoUrl(gridboxUrl);
        setCustomerLogoUrl(customerUrl);
        setFooterLogoUrl(footerUrl || gridboxUrl);
      } catch {
        if (!active) return;
        setGridboxLogoUrl(null);
        setCustomerLogoUrl(null);
        setFooterLogoUrl(null);
      }
    }

    loadBrandingAssets();

    return () => {
      active = false;
      urlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setBoxes([]);
      setLoading(false);
      setMessage("Meld je aan om boxen te bekijken");
      return;
    }

    loadBoxes();

    const intervalId = window.setInterval(() => {
      loadBoxes();
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [user, loadBoxes]);

  useEffect(() => {
    if (!toast) return;
    const timeoutId = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);


  const siteGroups = useMemo<SiteGroup[]>(() => {
    const grouped = new Map<string, SiteGroup>();

    [...boxes]
      .sort((a, b) => a.id.localeCompare(b.id))
      .forEach((box) => {
        const key = box.siteId || "unknown-site";
        const existing = grouped.get(key);

        if (existing) {
          existing.boxes.push(box);
          return;
        }

        grouped.set(key, {
          siteId: key,
          siteName: box.siteName || "Onbekende site",
          boxes: [box],
        });
      });

    return [...grouped.values()].sort((a, b) => a.siteName.localeCompare(b.siteName));
  }, [boxes]);

  const filterOptions = useMemo(() => {
    return siteGroups.map((group) => ({
      siteId: group.siteId,
      siteName: group.siteName,
    }));
  }, [siteGroups]);

  useEffect(() => {
    if (loading) return;
    if (selectedSiteId === "all") return;
    if (filterOptions.length === 0) return;
    const stillExists = filterOptions.some((option) => option.siteId === selectedSiteId);
    if (!stillExists) {
      setSelectedSiteId("all");
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("site");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, [filterOptions, selectedSiteId, loading]);

  const visibleGroups = useMemo(() => {
    if (selectedSiteId === "all") return siteGroups;
    return siteGroups.filter((group) => group.siteId === selectedSiteId);
  }, [selectedSiteId, siteGroups]);

  const totalBoxCount = boxes.length;
  const visibleBoxCount = visibleGroups.reduce((sum, group) => sum + group.boxes.length, 0);
  const isAllSitesActive = selectedSiteId === "all";

  async function handleLogin() {
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
      setBoxes([]);
      setSiteId("all");
      setGridboxLogoUrl(null);
      setCustomerLogoUrl(null);
      setFooterLogoUrl(null);
    } catch {
      setMessage("Uitloggen mislukt");
    }
  }

  async function handleActivateShare(boxId: string, shareId: string) {
    if (!window.confirm(`SMS versturen naar ${shareId}?`)) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(apiUrl(`/portal/boxes/${encodeURIComponent(boxId)}/shares/${encodeURIComponent(shareId)}/activate`), {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setToast("SMS succesvol verstuurd! ✉️");
        void loadBoxes();
      } else {
        setToast("Fout bij versturen SMS.");
      }
    } catch {
      setToast("Netwerkfout bij versturen.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-4 lg:px-8 lg:py-6">
      <div className="space-y-4">

        {/* Header card */}
        <section className="bg-white border border-slate-200 rounded-3xl shadow-sm px-4 py-5 lg:px-8 lg:py-6 overflow-hidden">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">

            {/* Logo + titel + sync badge */}
            <div className="flex items-center gap-5">
              {gridboxLogoUrl ? (
                <img src={gridboxLogoUrl} alt="Gridbox" className="h-16 lg:h-32 w-auto max-w-[120px] lg:max-w-[200px] object-contain shrink-0" />
              ) : (
                <div className="flex w-16 h-16 items-center justify-center rounded-xl bg-slate-900 text-white text-sm font-bold shrink-0">
                  GB
                </div>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 mb-1">
                  Beheerdashboard
                </p>
                <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 leading-tight">
                  Gridbox Dashboard
                </h1>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 px-3 py-1 text-xs font-semibold">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                  Live auto-sync actief
                </div>
              </div>
            </div>

            {/* Gebruikersblok */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 lg:min-w-[240px]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 mb-3">
                Aangemeld als
              </p>
              {user ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-900 leading-snug">
                      {user.displayName || "Onbekende gebruiker"}
                    </div>
                    <div className="text-sm text-slate-500 break-all mt-0.5">
                      {user.email || "Geen e-mail"}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    {customerLogoUrl ? (
                      <img src={customerLogoUrl} alt="Klantlogo" className="h-8 w-auto object-contain" />
                    ) : (
                      <div className="h-8 w-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-semibold text-slate-500">
                        KLANT
                      </div>
                    )}
                    <button
                      onClick={handleLogout}
                      className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800 transition-colors"
                    >
                      Afmelden
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="text-sm text-slate-500">
                    Meld je aan om je Gridboxen te bekijken.
                  </div>
                  <button
                    onClick={handleLogin}
                    className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800 transition-colors"
                  >
                    Aanmelden met Google
                  </button>
                </div>
              )}
            </div>

          </div>
        </section>

        {/* Filter balk */}
        <section className="bg-white border border-slate-200 rounded-3xl shadow-sm px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 mr-1">
              Locatie
            </span>
            <button
              onClick={() => setSiteId("all")}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                isAllSitesActive
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
              }`}
            >
              Alle sites
            </button>
            {filterOptions.map((option) => {
              const isActive = !isAllSitesActive && selectedSiteId === option.siteId;
              return (
                <button
                  key={option.siteId}
                  onClick={() => setSiteId(option.siteId)}
                  className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  {option.siteName}
                </button>
              );
            })}
            <span className="ml-auto text-sm text-slate-500">
              {visibleBoxCount} van {totalBoxCount} Gridboxen
            </span>
          </div>
        </section>

        {/* Laadindicator / foutmelding */}
        {loading && boxes.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm px-6 py-4 text-sm text-slate-500">
            Boxen laden...
          </div>
        )}
        {message && !loading && (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm px-6 py-4 text-sm text-slate-600 font-semibold">
            {message}
          </div>
        )}

        {/* Sitegroepen */}
        {visibleGroups.map((group) => (
          <section key={group.siteId} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 mb-3 px-1">
              {group.siteName}
            </h2>

            <div className="space-y-3">
              {group.boxes.map((box) => (
                <article
                  key={box.id}
                  className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 lg:p-8 flex flex-wrap items-start justify-between gap-6"
                >
                  {/* Linker kolom: box-info + acties */}
                  <div className="flex flex-col gap-4 flex-1 min-w-0">

                    {/* Naam + status */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-2xl font-bold text-slate-900">
                        {box.id.toUpperCase()}
                      </h3>
                      <span className={getStatusClasses(box.status)}>
                        {getStatusLabel(box.status)}
                      </span>
                      {box.occupancy === "empty" && (
                        <span className="rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold px-3 py-1">📦 Leeg</span>
                      )}
                      {box.occupancy === "occupied" && (
                        <span className="rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold px-3 py-1">📦 Bezet</span>
                      )}
                    </div>

                    {/* Beschrijving + meta */}
                    <div>
                      <div className="text-base font-semibold text-slate-700">
                        {box.displayName}
                      </div>
                      <div className="text-sm text-slate-400 mt-0.5 truncate">
                        Laatste actie: {formatLastAction(box)}
                      </div>
                    </div>

                    {/* Actieknoppen */}
                    <div className="flex gap-3 flex-wrap">
                      <div className="min-w-[160px]">
                        <SmartToggleButton
                          boxId={box.id}
                          boxName={box.displayName}
                          isOpen={box.boxIsOpen}
                          canInteract={box.canOpen}
                          onNotify={(msg) => setToast(msg)}
                          onActionComplete={loadBoxes}
                        />
                      </div>
                      <Link
                        href={`/portal/box?id=${encodeURIComponent(box.id)}`}
                        className="inline-flex items-center justify-center rounded-xl bg-slate-900 text-white px-5 py-3 text-base font-semibold hover:bg-slate-800 transition-colors no-underline"
                      >
                        Meer / Cockpit
                      </Link>
                      <Link
                        href={`/portal/box?id=${encodeURIComponent(box.id)}&tab=toegang`}
                        className="inline-flex items-center justify-center rounded-xl bg-slate-900 text-white px-5 py-3 text-base font-semibold hover:bg-slate-800 transition-colors no-underline"
                      >
                        Toegang beheren
                      </Link>
                    </div>
                  </div>

                  {/* Rechter kolom: GSM-paneel */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 w-full lg:w-auto lg:min-w-[240px] lg:shrink-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 mb-3">
                      Gedeelde gsm-nummers
                    </p>
                    {box.shareSummary && box.shareSummary.phoneNumbers.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {box.shareSummary.phoneNumbers.map((entry) => (
                          entry.active ? (
                            <span
                              key={entry.number}
                              className="relative group rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-sm font-semibold px-3 py-1 cursor-default"
                            >
                              {entry.number}
                              {entry.comment && (
                                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] rounded-xl bg-slate-900 text-white text-xs font-semibold px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10 whitespace-normal text-center">
                                  {entry.comment}
                                </span>
                              )}
                            </span>
                          ) : (
                            <button
                              key={entry.number}
                              onClick={() => handleActivateShare(box.id, entry.number)}
                              title={`SMS versturen naar ${entry.number}`}
                              className="relative group inline-flex items-center rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-sm font-semibold overflow-hidden hover:bg-blue-100 transition-colors"
                            >
                              <span className="px-3 py-1">{entry.number}</span>
                              <span className="w-px self-stretch bg-blue-200" />
                              <span className="px-2 py-1 flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <rect width="20" height="16" x="2" y="4" rx="2"/>
                                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                                </svg>
                              </span>
                              {entry.comment && (
                                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] rounded-xl bg-slate-900 text-white text-xs font-semibold px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10 whitespace-normal text-center">
                                  {entry.comment}
                                </span>
                              )}
                            </button>
                          )
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-slate-400 mt-2">
                      {box.shareSummary?.totalActive || 0} nummers gekoppeld
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

        {/* Footer */}
        <footer className="mt-4 py-8 text-center">
          <div className="inline-flex items-center justify-center gap-2 flex-wrap">
            {footerLogoUrl && (
              <img src={footerLogoUrl} alt="Gridbox footer" className="h-16 w-auto object-contain opacity-60" />
            )}
            <span className="text-sm font-semibold text-slate-500">{footerText}</span>
          </div>
        </footer>

      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed right-6 bottom-6 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-xl text-sm font-semibold z-50">
          {toast}
        </div>
      )}
    </main>
  );
}
