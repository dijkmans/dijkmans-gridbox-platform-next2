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
  if (status === "online") return "ONLINE";
  if (status === "offline") return "OFFLINE";
  if (status === "warning") return "WAARSCHUWING";
  return "ONBEKEND";
}

function getStatusColors(status: PortalBox["status"]) {
  if (status === "online") {
    return {
      background: "#dcfce7",
      color: "#166534",
      border: "#86efac"
    };
  }

  if (status === "offline") {
    return {
      background: "#fee2e2",
      color: "#991b1b",
      border: "#fca5a5"
    };
  }

  if (status === "warning") {
    return {
      background: "#fef3c7",
      color: "#92400e",
      border: "#fcd34d"
    };
  }

  return {
    background: "#e5e7eb",
    color: "#374151",
    border: "#d1d5db"
  };
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
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        color: "#111827",
        fontFamily: "Arial, sans-serif",
        padding: "22px"
      }}
    >
      <div style={{ maxWidth: "1320px", margin: "0 auto" }}>
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 220px",
            gap: "18px",
            alignItems: "stretch",
            marginBottom: "18px"
          }}
        >
          {/* Header Dashboard Block */}
          <div style={{ background: "#ffffff", borderRadius: "24px", padding: "10px 14px", boxShadow: "0 14px 40px rgba(15, 23, 42, 0.08)", border: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              {gridboxLogoUrl ? (
                <img src={gridboxLogoUrl} alt="Gridbox" style={{ width: "96px", height: "42px", objectFit: "contain", borderRadius: "14px", background: "#ffffff" }} />
              ) : (
                <div style={{ width: "88px", height: "42px", borderRadius: "16px", background: "#0f172a", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "14px" }}>
                  GRIDBOX
                </div>
              )}
              <div>
                <div style={{ fontSize: "22px", fontWeight: 900, letterSpacing: "0.03em", lineHeight: 1.1 }}>GRIDBOX DASHBOARD</div>
                <div style={{ marginTop: "4px", color: "#059669", fontWeight: 800, fontSize: "14px" }}>LIVE AUTO-SYNC ACTIEF</div>
              </div>
            </div>
          </div>

          {/* User Block */}
          <div style={{ background: "#ffffff", borderRadius: "24px", padding: "14px 16px", boxShadow: "0 14px 40px rgba(15, 23, 42, 0.08)", border: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.12em", color: "#6b7280", marginBottom: "12px" }}>AANGEMELD ALS</div>
            {user ? (
              <>
                <div style={{ fontSize: "17px", fontWeight: 800, lineHeight: 1.25 }}>{user.displayName || "Onbekende gebruiker"}</div>
                <div style={{ color: "#4b5563", marginTop: "6px", marginBottom: "8px", wordBreak: "break-word" }}>{user.email || "Geen e-mail"}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  {customerLogoUrl ? (
                    <img src={customerLogoUrl} alt="Klantlogo" style={{ width: "108px", height: "42px", objectFit: "contain", borderRadius: "14px" }} />
                  ) : (
                    <div style={{ minWidth: "68px", height: "42px", borderRadius: "14px", background: "#eef2ff", color: "#312e81", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>KLANT</div>
                  )}
                  <button onClick={handleLogout} style={{ border: "none", borderRadius: "14px", background: "#0f172a", color: "#ffffff", padding: "11px 15px", fontWeight: 700, cursor: "pointer" }}>Afmelden</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: "17px", fontWeight: 700, marginBottom: "4px" }}>Niet aangemeld</div>
                <div style={{ color: "#4b5563", marginBottom: "16px" }}>Meld je aan om je Gridboxen te bekijken.</div>
                <button onClick={handleLogin} style={{ border: "none", borderRadius: "14px", background: "#0f172a", color: "#ffffff", padding: "11px 15px", fontWeight: 700, cursor: "pointer" }}>Aanmelden met Google</button>
              </>
            )}
          </div>
        </section>

        {/* View Filter */}
        <section style={{ background: "#ffffff", borderRadius: "24px", padding: "16px 20px", boxShadow: "0 14px 40px rgba(15, 23, 42, 0.08)", border: "1px solid #e5e7eb", marginBottom: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.1em", color: "#6b7280", marginRight: "2px" }}>VIEW-FILTER</div>
            <button onClick={() => setSelectedSiteId("all")} style={{ border: selectedSiteId === "all" ? "1px solid #0f172a" : "1px solid #d1d5db", borderRadius: "999px", background: selectedSiteId === "all" ? "#0f172a" : "#ffffff", color: selectedSiteId === "all" ? "#ffffff" : "#111827", padding: "9px 15px", fontWeight: 700, cursor: "pointer" }}>Alle sites</button>
            {filterOptions.map((option) => (
              <button key={option.siteId} onClick={() => setSelectedSiteId(option.siteId)} style={{ border: selectedSiteId === option.siteId ? "1px solid #0f172a" : "1px solid #d1d5db", borderRadius: "999px", background: selectedSiteId === option.siteId ? "#0f172a" : "#ffffff", color: selectedSiteId === option.siteId ? "#ffffff" : "#111827", padding: "9px 15px", fontWeight: 700, cursor: "pointer" }}>{option.siteName}</button>
            ))}
            <div style={{ marginLeft: "auto", color: "#4b5563", fontWeight: 700 }}>{visibleBoxCount} van {totalBoxCount} Gridboxen zichtbaar</div>
          </div>
        </section>

        {loading && boxes.length === 0 && <div style={{ background: "#ffffff", borderRadius: "20px", padding: "14px 16px", border: "1px solid #e5e7eb", marginBottom: "18px" }}>Boxen laden...</div>}
        {message && !loading && <div style={{ background: "#ffffff", borderRadius: "20px", padding: "14px 16px", border: "1px solid #e5e7eb", marginBottom: "18px", color: "#374151", fontWeight: 600 }}>{message}</div>}

        {visibleGroups.map((group) => (
          <section key={group.siteId} style={{ marginBottom: "26px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 900, letterSpacing: "0.04em", marginBottom: "14px" }}>{group.siteName.toUpperCase()}</h2>

            {/* DE ECHTE HORIZONTALE LAYOUT VAN JOUW MOCKUP */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "18px" }}>
              {group.boxes.map((box) => {
                const statusColors = getStatusColors(box.status);

                return (
                  <article
                    key={box.id}
                    style={{
                      width: "100%",
                      background: "#ffffff",
                      borderRadius: "16px",
                      padding: "24px",
                      border: "1px solid #d1d5db",
                      boxShadow: "0 4px 12px rgba(15, 23, 42, 0.05)",
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "24px"
                    }}
                  >
                    {/* LINKER KANT: Info, Status & Knoppen */}
                    <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: "16px" }}>
                      
                      {/* Titel & Status naast elkaar */}
                      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                        <h3 style={{ fontSize: "22px", fontWeight: 900, margin: 0, color: "#111827" }}>
                          {box.id.toUpperCase()}
                        </h3>
                        <div style={{ border: `1px solid ${statusColors.border}`, background: statusColors.background, color: statusColors.color, borderRadius: "999px", padding: "6px 12px", fontSize: "11px", fontWeight: 800, whiteSpace: "nowrap" }}>
                          {getStatusLabel(box.status)}
                        </div>
                      </div>

                      {/* Subtitel & Info */}
                      <div>
                        <div style={{ fontSize: "15px", fontWeight: 700, color: "#374151" }}>
                          {box.displayName}
                        </div>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "#4b5563", marginTop: "4px" }}>
                          Laatste actie: {formatLastAction(box)}
                        </div>
                      </div>

                      {/* Knoppen op een rij */}
                      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "4px" }}>
                        <div style={{ minWidth: "160px" }}>
                          <SmartToggleButton boxId={box.id} boxName={box.displayName} isOpen={box.boxIsOpen} canInteract={box.canOpen} onNotify={(msg) => setToast(msg)} onActionComplete={loadBoxes} />
                        </div>
                        <Link href={`/portal/box?id=${encodeURIComponent(box.id)}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "12px", border: "1px solid #d1d5db", background: "#ffffff", color: "#111827", padding: "0 20px", height: "46px", fontWeight: 800, fontSize: "13px", textDecoration: "none" }}>
                          MEER / COCKPIT
                        </Link>
                      </div>
                    </div>

                    {/* RECHTER KANT: GSM Nummers (Grijze Box) */}
                    <div style={{ flex: "0 0 auto", minWidth: "300px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 800, color: "#6b7280", letterSpacing: "0.05em", marginBottom: "16px" }}>
                        GEDEELDE GSM-NUMMERS
                      </div>

                      {/* Pillen per nummer (als ze in de data zitten) */}
                      {box.shareSummary && box.shareSummary.phoneNumbers && box.shareSummary.phoneNumbers.length > 0 ? (
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
                          {box.shareSummary.phoneNumbers.map((num) => (
                            <div key={num} style={{ background: "#ffffff", border: "1px solid #bfdbfe", borderRadius: "999px", padding: "6px 14px", fontSize: "13px", fontWeight: 700, color: "#1e40af", display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "14px" }}>{"\u{1F4F1}"}</span> {num}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#374151" }}>
                        {box.shareSummary?.totalActive || 0} nummers gekoppeld
                      </div>
                    </div>

                  </article>
                );
              })}
            </div>
          </section>
        ))}

        <footer style={{ marginTop: "12px", padding: "12px 0 6px 0", textAlign: "center", color: "#6b7280", fontWeight: 700 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
            {footerLogoUrl && <img src={footerLogoUrl} alt="Gridbox footer" style={{ height: "22px", width: "auto", objectFit: "contain" }} />}
            <span>{footerText}</span>
          </div>
        </footer>
      </div>

      {toast && (
        <div style={{ position: "fixed", right: "24px", bottom: "24px", background: "#111827", color: "#ffffff", padding: "14px 18px", borderRadius: "14px", boxShadow: "0 16px 40px rgba(17, 24, 39, 0.28)", fontWeight: 700, zIndex: 1000 }}>
          {toast}
        </div>
      )}
    </main>
  );
}