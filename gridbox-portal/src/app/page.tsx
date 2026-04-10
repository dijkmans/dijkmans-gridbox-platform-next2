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
    phoneNumbers: string[];
  };
  links: {
    detail: string;
    history?: string;
  };
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
  if (status === "online") return "online";
  if (status === "offline") return "offline";
  if (status === "warning") return "waarschuwing";
  return "onbekend";
}

function getStatusBadgeClass(status: PortalBox["status"]) {
  if (status === "online") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-400";
}

function getStatusDotClass(status: PortalBox["status"]) {
  if (status === "online") return "bg-emerald-500";
  if (status === "warning") return "bg-amber-400";
  return "bg-slate-300";
}

function formatBoxId(id: string) {
  if (!id) return id;
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function formatTimeAgo(value?: string) {
  if (!value) return "onbekend";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "onbekend";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) {
    return "zojuist";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min geleden`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} uur geleden`;
  }

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
    headers: {
      Authorization: `Bearer ${token}`
    },
    cache: "no-store"
  });

  if (!res.ok) {
    return null;
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [boxes, setBoxes] = useState<PortalBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState<string>("all");
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
        headers: {
          Authorization: `Bearer ${token}`
        },
        cache: "no-store"
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
    } catch (error) {
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
          fetchProtectedAssetUrl(token, "/portal/assets/gridbox-footer-logo")
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
      } catch (error) {
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

    const timeoutId = window.setTimeout(() => {
      setToast("");
    }, 3500);

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
          boxes: [box]
        });
      });

    return [...grouped.values()].sort((a, b) => a.siteName.localeCompare(b.siteName));
  }, [boxes]);

  const filterOptions = useMemo(() => {
    return siteGroups.map((group) => ({
      siteId: group.siteId,
      siteName: group.siteName
    }));
  }, [siteGroups]);

  useEffect(() => {
    if (selectedSiteId === "all") return;

    const stillExists = filterOptions.some((option) => option.siteId === selectedSiteId);

    if (!stillExists) {
      setSelectedSiteId("all");
    }
  }, [filterOptions, selectedSiteId]);

  const visibleGroups = useMemo(() => {
    if (selectedSiteId === "all") {
      return siteGroups;
    }

    return siteGroups.filter((group) => group.siteId === selectedSiteId);
  }, [selectedSiteId, siteGroups]);

  const totalBoxCount = boxes.length;
  const visibleBoxCount = visibleGroups.reduce((sum, group) => sum + group.boxes.length, 0);

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
      setBoxes([]);
      setSelectedSiteId("all");
      setGridboxLogoUrl(null);
      setCustomerLogoUrl(null);
      setFooterLogoUrl(null);
    } catch (error) {
      setMessage("Uitloggen mislukt");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">

      {/* ─── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">

          {/* Logo */}
          <div className="flex items-center gap-3">
            {gridboxLogoUrl ? (
              <img src={gridboxLogoUrl} alt="Gridbox" className="h-8 w-auto object-contain" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900">
                <svg className="h-4 w-4 text-white" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="1" y="1" width="6" height="6" rx="1.5"/>
                  <rect x="9" y="1" width="6" height="6" rx="1.5"/>
                  <rect x="1" y="9" width="6" height="6" rx="1.5"/>
                  <rect x="9" y="9" width="6" height="6" rx="1.5"/>
                </svg>
              </div>
            )}
            <div className="leading-tight">
              <div className="text-sm font-bold text-slate-900">Gridbox</div>
              <div className="text-[11px] text-slate-400">Klantportaal</div>
            </div>
          </div>

          {/* User */}
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <div className="text-sm font-semibold text-slate-900">{user.displayName || "Gebruiker"}</div>
                <div className="text-xs text-slate-400">{user.email || ""}</div>
              </div>
              {customerLogoUrl && (
                <img src={customerLogoUrl} alt="Klantlogo" className="hidden h-7 w-auto object-contain sm:block" />
              )}
              <button
                onClick={handleLogout}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Afmelden
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Aanmelden met Google
            </button>
          )}
        </div>
      </header>

      {/* ─── Main ───────────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-6 py-8">

        {/* Site filter */}
        <div className="mb-7 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Site</span>
          <button
            onClick={() => setSelectedSiteId("all")}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
              selectedSiteId === "all"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Alle sites
          </button>
          {filterOptions.map((option) => (
            <button
              key={option.siteId}
              onClick={() => setSelectedSiteId(option.siteId)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                selectedSiteId === option.siteId
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {option.siteName}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-400">
            {visibleBoxCount} van {totalBoxCount} boxen
          </span>
        </div>

        {/* Loading / message */}
        {loading && boxes.length === 0 && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">
            Boxen laden...
          </div>
        )}
        {message && !loading && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700">
            {message}
          </div>
        )}

        {/* Site groups */}
        {visibleGroups.map((group) => (
          <section key={group.siteId} className="mb-8">

            {/* Site label */}
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Site</span>
              <span className="text-sm font-semibold text-slate-700">{group.siteName}</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                {group.boxes.length} {group.boxes.length === 1 ? "box" : "boxen"}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {group.boxes.map((box) => (
                <article
                  key={box.id}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]"
                >
                  <div className="flex flex-wrap items-start gap-5 px-6 py-5">

                    {/* Left: identity + actions */}
                    <div className="flex min-w-0 flex-1 flex-col gap-1">

                      {/* Name + status */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-base font-bold text-slate-900">
                          {formatBoxId(box.id)}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${getStatusBadgeClass(box.status)}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${getStatusDotClass(box.status)}`} />
                          {getStatusLabel(box.status)}
                        </span>
                        {box.boxIsOpen && (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            open
                          </span>
                        )}
                      </div>

                      {/* Display name */}
                      <div className="text-sm text-slate-500">{box.displayName}</div>

                      {/* Last action */}
                      <div className="mt-0.5 text-xs text-slate-400">
                        {formatLastAction(box)}
                      </div>

                      {/* Buttons */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <SmartToggleButton
                          boxId={box.id}
                          boxName={box.displayName}
                          isOpen={box.boxIsOpen}
                          canInteract={box.canOpen}
                          onNotify={(msg) => setToast(msg)}
                          onActionComplete={loadBoxes}
                        />
                        <Link
                          href={`/portal/box?id=${encodeURIComponent(box.id)}#toegang`}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Toegang beheren
                        </Link>
                        <Link
                          href={`/portal/box?id=${encodeURIComponent(box.id)}`}
                          className="px-2 py-2 text-sm font-semibold text-slate-400 transition hover:text-slate-700"
                        >
                          Details →
                        </Link>
                      </div>
                    </div>

                    {/* Right: GSM numbers */}
                    {box.shareSummary && (
                      <div className="w-64 shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Gedeelde toegang
                        </div>
                        {box.shareSummary.phoneNumbers && box.shareSummary.phoneNumbers.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {box.shareSummary.phoneNumbers.map((num) => (
                              <span
                                key={num}
                                className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-semibold text-blue-700"
                              >
                                <svg className="h-3 w-3 shrink-0" viewBox="0 0 12 12" fill="currentColor">
                                  <path d="M8 1H4a1 1 0 00-1 1v8a1 1 0 001 1h4a1 1 0 001-1V2a1 1 0 00-1-1zM6 10.25a.75.75 0 110-1.5.75.75 0 010 1.5z"/>
                                </svg>
                                {num}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-3 text-xs text-slate-400">
                          {box.shareSummary.totalActive || 0} {(box.shareSummary.totalActive || 0) === 1 ? "nummer" : "nummers"} gekoppeld
                        </div>
                      </div>
                    )}

                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

      </main>

      {/* ─── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            {footerLogoUrl ? (
              <img src={footerLogoUrl} alt="Gridbox" className="h-5 w-auto object-contain" />
            ) : (
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-900">
                <svg className="h-3 w-3 text-white" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="1" y="1" width="6" height="6" rx="1.5"/>
                  <rect x="9" y="1" width="6" height="6" rx="1.5"/>
                  <rect x="1" y="9" width="6" height="6" rx="1.5"/>
                  <rect x="9" y="9" width="6" height="6" rx="1.5"/>
                </svg>
              </div>
            )}
            <span className="text-xs text-slate-400">{footerText}</span>
          </div>
          <span className="text-xs text-slate-300">© 2026</span>
        </div>
      </footer>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-900 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          {toast}
        </div>
      )}

    </div>
  );
}