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
  return `${timePart} • ${statePart} • ${sourcePart}`;
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
          <div
            style={{
              background: "#ffffff",
              borderRadius: "24px",
              padding: "16px 18px",
              boxShadow: "0 14px 40px rgba(15, 23, 42, 0.08)",
              border: "1px solid #e5e7eb"
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                flexWrap: "wrap"
              }}
            >
              {gridboxLogoUrl ? (
                <img
                  src={gridboxLogoUrl}
                  alt="Gridbox"
                  style={{
                    width: "96px",
                    height: "42px",
                    objectFit: "contain",
                    borderRadius: "16px",
                    background: "#ffffff",
                    padding: "0px"
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "88px",
                    height: "42px",
                    borderRadius: "18px",
                    background: "#0f172a",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    letterSpacing: "0.06em",
                    fontSize: "14px"
                  }}
                >
                  GRIDBOX
                </div>
              )}

              <div>
                <div
                  style={{
                    fontSize: "22px",
                    fontWeight: 900,
                    letterSpacing: "0.03em",
                    lineHeight: 1.1
                  }}
                >
                  GRIDBOX DASHBOARD
                </div>
                <div
                  style={{
                    marginTop: "8px",
                    color: "#059669",
                    fontWeight: 800,
                    fontSize: "14px"
                  }}
                >
                  LIVE AUTO-SYNC ACTIEF
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              borderRadius: "24px",
              padding: "14px 16px",
              boxShadow: "0 14px 40px rgba(15, 23, 42, 0.08)",
              border: "1px solid #e5e7eb"
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "0.12em",
                color: "#6b7280",
                marginBottom: "12px"
              }}
            >
              AANGEMELD ALS
            </div>

            {user ? (
              <>
                <div style={{ fontSize: "17px", fontWeight: 800, lineHeight: 1.25 }}>
                  {user.displayName || "Onbekende gebruiker"}
                </div>
                <div style={{ color: "#4b5563", marginTop: "6px", marginBottom: "16px", wordBreak: "break-word" }}>
                  {user.email || "Geen e-mail"}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px"
                  }}
                >
                  {customerLogoUrl ? (
                    <img
                      src={customerLogoUrl}
                      alt="Klantlogo"
                      style={{
                        width: "108px",
                        height: "42px",
                        objectFit: "contain",
                        borderRadius: "16px",
                        background: "#ffffff",
                        padding: "0px"
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        minWidth: "68px",
                        height: "42px",
                        borderRadius: "16px",
                        background: "#eef2ff",
                        color: "#312e81",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        padding: "10px",
                        textAlign: "center"
                      }}
                    >
                      KLANT
                    </div>
                  )}

                  <button
                    onClick={handleLogout}
                    style={{
                      border: "none",
                      borderRadius: "14px",
                      background: "#0f172a",
                      color: "#ffffff",
                      padding: "11px 15px",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    Afmelden
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: "17px", fontWeight: 700, marginBottom: "8px" }}>
                  Niet aangemeld
                </div>
                <div style={{ color: "#4b5563", marginBottom: "16px" }}>
                  Meld je aan om je Gridboxen te bekijken.
                </div>
                <button
                  onClick={handleLogin}
                  style={{
                    border: "none",
                    borderRadius: "14px",
                    background: "#0f172a",
                    color: "#ffffff",
                    padding: "11px 15px",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  Aanmelden met Google
                </button>
              </>
            )}
          </div>
        </section>

        <section
          style={{
            background: "#ffffff",
            borderRadius: "24px",
            padding: "16px 20px",
            boxShadow: "0 14px 40px rgba(15, 23, 42, 0.08)",
            border: "1px solid #e5e7eb",
            marginBottom: "18px"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap"
            }}
          >
            <div
              style={{
                fontSize: "13px",
                fontWeight: 800,
                letterSpacing: "0.1em",
                color: "#6b7280",
                marginRight: "2px"
              }}
            >
              VIEW-FILTER
            </div>

            <button
              onClick={() => setSelectedSiteId("all")}
              style={{
                border: selectedSiteId === "all" ? "1px solid #0f172a" : "1px solid #d1d5db",
                borderRadius: "999px",
                background: selectedSiteId === "all" ? "#0f172a" : "#ffffff",
                color: selectedSiteId === "all" ? "#ffffff" : "#111827",
                padding: "9px 15px",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Alle sites
            </button>

            {filterOptions.map((option) => (
              <button
                key={option.siteId}
                onClick={() => setSelectedSiteId(option.siteId)}
                style={{
                  border: selectedSiteId === option.siteId ? "1px solid #0f172a" : "1px solid #d1d5db",
                  borderRadius: "999px",
                  background: selectedSiteId === option.siteId ? "#0f172a" : "#ffffff",
                  color: selectedSiteId === option.siteId ? "#ffffff" : "#111827",
                  padding: "9px 15px",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                {option.siteName}
              </button>
            ))}

            <div
              style={{
                marginLeft: "auto",
                color: "#4b5563",
                fontWeight: 700
              }}
            >
              {visibleBoxCount} van {totalBoxCount} Gridboxen zichtbaar
            </div>
          </div>
        </section>

        {loading && boxes.length === 0 && (
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              padding: "14px 16px",
              border: "1px solid #e5e7eb",
              marginBottom: "18px"
            }}
          >
            Boxen laden...
          </div>
        )}

        {message && !loading && (
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              padding: "14px 16px",
              border: "1px solid #e5e7eb",
              marginBottom: "18px",
              color: "#374151",
              fontWeight: 600
            }}
          >
            {message}
          </div>
        )}

        {!loading && !message && visibleGroups.length === 0 && (
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              padding: "14px 16px",
              border: "1px solid #e5e7eb",
              marginBottom: "18px",
              color: "#374151",
              fontWeight: 600
            }}
          >
            Geen Gridboxen zichtbaar voor deze filter.
          </div>
        )}

        {visibleGroups.map((group) => (
          <section key={group.siteId} style={{ marginBottom: "26px" }}>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 900,
                letterSpacing: "0.04em",
                marginBottom: "14px"
              }}
            >
              {group.siteName.toUpperCase()}
            </h2>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "18px",
                alignItems: "stretch"
              }}
            >
              {group.boxes.map((box) => {
                const statusColors = getStatusColors(box.status);

                return (
                  <article
                    key={box.id}
                    style={{
                      width: "100%",
                      maxWidth: "520px",
                      background: "#ffffff",
                      borderRadius: "24px",
                      padding: "18px",
                      border: "1px solid #e5e7eb",
                      boxShadow: "0 12px 30px rgba(15, 23, 42, 0.07)"
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "12px",
                        marginBottom: "10px"
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "20px",
                            fontWeight: 900,
                            letterSpacing: "0.05em",
                            lineHeight: 1.1
                          }}
                        >
                          {box.id.toUpperCase()}
                        </div>

                        <div
                          style={{
                            marginTop: "8px",
                            color: "#374151",
                            fontWeight: 600
                          }}
                        >
                          {box.displayName}
                        </div>
                      </div>

                      <div
                        style={{
                          border: `1px solid ${statusColors.border}`,
                          background: statusColors.background,
                          color: statusColors.color,
                          borderRadius: "999px",
                          padding: "7px 11px",
                          fontSize: "12px",
                          fontWeight: 800,
                          letterSpacing: "0.08em",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {getStatusLabel(box.status)}
                      </div>
                    </div>

                    <div
                      style={{
                        marginBottom: "16px",
                        color: "#111827",
                        fontWeight: 700,
                        lineHeight: 1.4
                      }}
                    >
                      Laatste actie: {formatLastAction(box)}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "14px",
                        alignItems: "stretch",
                        flexWrap: "wrap",
                        marginBottom: "10px"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                          flex: "0 0 210px",
                          minWidth: "210px"
                        }}
                      >
                        <SmartToggleButton
                          boxId={box.id}
                          boxName={box.displayName}
                          isOpen={box.boxIsOpen}
                          canInteract={box.canOpen}
                          onNotify={(msg) => setToast(msg)}
                          onActionComplete={loadBoxes}
                        />

                        <Link
                          href={`/portal/box?id=${encodeURIComponent(box.id)}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            textDecoration: "none",
                            borderRadius: "16px",
                            border: "1px solid #d1d5db",
                            background: "#f9fafb",
                            color: "#111827",
                            padding: "0 18px",
                            minHeight: "52px",
                            fontWeight: 800,
                            width: "100%"
                          }}
                        >
                          MEER / COCKPIT
                        </Link>


                      </div>

                      <div
                        style={{
                          flex: "1 1 320px",
                          minWidth: "320px",
                          background: "#f8fafc",
                          border: "1px solid #e5e7eb",
                          borderRadius: "18px",
                          padding: "14px"
                        }}
                      >
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: 800,
                            letterSpacing: "0.08em",
                            color: "#6b7280",
                            marginBottom: "8px"
                          }}
                        >
                          GEDEELDE GSM-NUMMERS
                        </div>

                        {box.shareSummary && box.shareSummary.totalActive > 0 ? (
                          <>
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "8px",
                                marginBottom: "10px"
                              }}
                            >
                              {box.shareSummary.phoneNumbers.map((phoneNumber) => (
                                <span
                                  key={phoneNumber}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    padding: "6px 10px",
                                    borderRadius: "999px",
                                    background: "#eef2ff",
                                    color: "#1f2937",
                                    fontWeight: 700,
                                    fontSize: "13px",
                                    border: "1px solid #c7d2fe"
                                  }}
                                >
                                  📱 {phoneNumber}
                                </span>
                              ))}

                              {box.shareSummary.totalActive > box.shareSummary.phoneNumbers.length && (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    padding: "6px 10px",
                                    borderRadius: "999px",
                                    background: "#f3f4f6",
                                    color: "#374151",
                                    fontWeight: 700,
                                    fontSize: "13px",
                                    border: "1px solid #d1d5db"
                                  }}
                                >
                                  + nog {box.shareSummary.totalActive - box.shareSummary.phoneNumbers.length}
                                </span>
                              )}
                            </div>
                            <div
                              style={{
                                color: "#4b5563",
                                fontWeight: 600,
                                lineHeight: 1.4
                              }}
                            >
                              {box.shareSummary.totalActive} nummer{box.shareSummary.totalActive === 1 ? "" : "s"} gekoppeld
                            </div>
                          </>
                        ) : (
                          <>
                            <div
                              style={{
                                color: "#4b5563",
                                fontWeight: 600,
                                lineHeight: 1.4,
                                marginBottom: "6px"
                              }}
                            >
                              Geen gedeelde nummers
                            </div>
                            <div
                              style={{
                                color: "#6b7280",
                                fontWeight: 600,
                                lineHeight: 1.4
                              }}
                            >
                              Deze Gridbox lijkt vrij
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        <footer
          style={{
            marginTop: "12px",
            padding: "12px 0 6px 0",
            textAlign: "center",
            color: "#6b7280",
            fontWeight: 700
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              flexWrap: "wrap"
            }}
          >
            {footerLogoUrl && (
              <img
                src={footerLogoUrl}
                alt="Gridbox footer"
                style={{
                  height: "22px",
                  width: "auto",
                  objectFit: "contain"
                }}
              />
            )}
            <span>{footerText}</span>
          </div>
        </footer>
      </div>

      {toast && (
        <div
          style={{
            position: "fixed",
            right: "24px",
            bottom: "24px",
            background: "#111827",
            color: "#ffffff",
            padding: "14px 18px",
            borderRadius: "16px",
            boxShadow: "0 16px 40px rgba(17, 24, 39, 0.28)",
            fontWeight: 700,
            maxWidth: "360px",
            zIndex: 1000
          }}
        >
          {toast}
        </div>
      )}
    </main>
  );
}






