"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import OpenBoxButton from "@/components/OpenBoxButton";
import CloseBoxButton from "@/components/CloseBoxButton";
import { auth } from "@/lib/firebase";
import { apiUrl } from "@/lib/api";

type BoxDetail = {
  id: string;
  displayName: string;
  siteName: string;
  status: string;
  lastHeartbeat?: string;
  lastSeen?: string;
  connectivitySummary: string;
  hardwareSummary: string;
  availableActions: {
    open: boolean;
    close: boolean;
  };
};

type BoxShareItem = {
  id: string;
  typeGuess?: "phone" | "uid" | "unknown";
  active?: boolean;
  label?: string | null;
  email?: string | null;
  role?: string | null;
  addedBy?: string | null;
  createdAt?: string | null;
};

type BoxPhotoItem = {
  id: string;
  filename: string;
  storagePath: string;
  updatedAt?: string | null;
  size?: string | null;
  contentType?: string | null;
};

const actionButtonStyle = {
  display: "inline-block",
  padding: "8px 12px",
  border: "1px solid #ccc",
  borderRadius: "6px",
  textDecoration: "none",
  color: "inherit",
  background: "#fff",
  cursor: "pointer"
} as const;

function PageContentRouter() {
  const searchParams = useSearchParams();
  const boxId = searchParams.get("id") || "";

  const [box, setBox] = useState<BoxDetail | null>(null);
  const [shares, setShares] = useState<BoxShareItem[]>([]);
  const [photos, setPhotos] = useState<BoxPhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [sharesMessage, setSharesMessage] = useState("");
  const [sharePhoneNumber, setSharePhoneNumber] = useState("");
  const [shareLabel, setShareLabel] = useState("");
  const [shareSubmitting, setShareSubmitting] = useState(false);
  const [sharesOpen, setSharesOpen] = useState(false);

  const [photosMessage, setPhotosMessage] = useState("");
  const [photosOpen, setPhotosOpen] = useState(false);
  const [photoPreviewLoading, setPhotoPreviewLoading] = useState(false);
  const [selectedPhotoFilename, setSelectedPhotoFilename] = useState("");
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState("");

  useEffect(() => {
    let active = true;

    async function loadBox() {
      try {
        setLoading(true);
        setMessage("");
        setSharesMessage("");
        setPhotosMessage("");

        if (!boxId) {
          if (active) {
            setBox(null);
            setShares([]);
            setPhotos([]);
            setMessage("Geen box-id opgegeven");
          }
          return;
        }

        const user = auth.currentUser;

        if (!user) {
          if (active) {
            setBox(null);
            setShares([]);
            setPhotos([]);
            setMessage("Meld je aan om boxdetails te bekijken");
            setSharesMessage("");
            setPhotosMessage("");
          }
          return;
        }

        const token = await user.getIdToken();

        const [boxRes, sharesRes, photosRes] = await Promise.all([
          fetch(apiUrl(`/portal/boxes/${boxId}`), {
            headers: {
              Authorization: `Bearer ${token}`
            },
            cache: "no-store"
          }),
          fetch(apiUrl(`/portal/boxes/${boxId}/shares`), {
            headers: {
              Authorization: `Bearer ${token}`
            },
            cache: "no-store"
          }),
          fetch(apiUrl(`/portal/boxes/${boxId}/photos`), {
            headers: {
              Authorization: `Bearer ${token}`
            },
            cache: "no-store"
          })
        ]);

        const boxData = await boxRes.json();
        const sharesData = await sharesRes.json();
        const photosData = await photosRes.json();

        if (!boxRes.ok) {
          if (active) {
            setBox(null);
            setShares([]);
            setPhotos([]);
            setMessage(boxData.message || "Kon boxdetail niet ophalen");
            setSharesMessage("");
            setPhotosMessage("");
          }
          return;
        }

        if (active) {
          setBox(boxData as BoxDetail);

          if (sharesRes.ok) {
            setShares(sharesData.items || []);
            setSharesMessage("");
          } else {
            setShares([]);
            setSharesMessage(sharesData.message || "Kon shares niet ophalen");
          }

          if (photosRes.ok) {
            setPhotos(photosData.items || []);
            setPhotosMessage("");
          } else {
            setPhotos([]);
            setPhotosMessage(photosData.message || "Kon foto's niet ophalen");
          }
        }
      } catch {
        if (active) {
          setBox(null);
          setShares([]);
          setPhotos([]);
          setMessage("Netwerkfout bij ophalen van boxdetail");
          setSharesMessage("Netwerkfout bij ophalen van shares");
          setPhotosMessage("Netwerkfout bij ophalen van foto's");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    const unsubscribe = auth.onAuthStateChanged(() => {
      void loadBox();
    });

    void loadBox();

    return () => {
      active = false;
      unsubscribe();
    };
  }, [boxId]);

  useEffect(() => {
    return () => {
      if (selectedPhotoUrl) {
        URL.revokeObjectURL(selectedPhotoUrl);
      }
    };
  }, [selectedPhotoUrl]);

  async function reloadShares() {
    const user = auth.currentUser;

    if (!user) {
      setShares([]);
      setSharesMessage("Meld je aan om shares te bekijken");
      return;
    }

    const token = await user.getIdToken();

    const sharesRes = await fetch(apiUrl(`/portal/boxes/${boxId}/shares`), {
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });

    const sharesData = await sharesRes.json();

    if (!sharesRes.ok) {
      setShares([]);
      setSharesMessage(sharesData.message || "Kon shares niet ophalen");
      return;
    }

    setShares(sharesData.items || []);
  }

  async function reloadPhotos() {
    const user = auth.currentUser;

    if (!user) {
      setPhotos([]);
      setPhotosMessage("Meld je aan om foto's te bekijken");
      return;
    }

    const token = await user.getIdToken();

    const photosRes = await fetch(apiUrl(`/portal/boxes/${boxId}/photos`), {
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });

    const photosData = await photosRes.json();

    if (!photosRes.ok) {
      setPhotos([]);
      setPhotosMessage(photosData.message || "Kon foto's niet ophalen");
      return;
    }

    setPhotos(photosData.items || []);
  }

  async function handleCreateShare() {
    const user = auth.currentUser;

    setSharesMessage("");

    if (!user) {
      setMessage("Meld je aan om boxdetails te bekijken");
      return;
    }

    const phoneNumber = sharePhoneNumber.trim();
    const label = shareLabel.trim();

    if (!phoneNumber) {
      setSharesMessage("Gsm-nummer is verplicht");
      setSharesOpen(true);
      return;
    }

    try {
      setShareSubmitting(true);

      const token = await user.getIdToken();

      const createRes = await fetch(apiUrl(`/portal/boxes/${boxId}/shares`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          phoneNumber,
          label
        })
      });

      const createData = await createRes.json();

      if (!createRes.ok) {
        setSharesMessage(createData.message || "Kon share niet aanmaken");
        setSharesOpen(true);
        return;
      }

      await reloadShares();

      setSharePhoneNumber("");
      setShareLabel("");
      setSharesMessage("Share aangemaakt. De sms-flow is gestart.");
      setSharesOpen(true);
    } catch {
      setSharesMessage("Netwerkfout bij aanmaken van share");
      setSharesOpen(true);
    } finally {
      setShareSubmitting(false);
    }
  }

  async function handleLoadPhoto(filename: string) {
    const user = auth.currentUser;

    setPhotosMessage("");
    setSelectedPhotoFilename(filename);

    if (!user) {
      setMessage("Meld je aan om boxdetails te bekijken");
      return;
    }

    try {
      setPhotoPreviewLoading(true);

      if (selectedPhotoUrl) {
        URL.revokeObjectURL(selectedPhotoUrl);
        setSelectedPhotoUrl("");
      }

      const token = await user.getIdToken();

      const res = await fetch(
        apiUrl(`/portal/boxes/${boxId}/photos/content?filename=${encodeURIComponent(filename)}`),
        {
          headers: {
            Authorization: `Bearer ${token}`
          },
          cache: "no-store"
        }
      );

      if (!res.ok) {
        let errorText = "Kon foto niet ophalen";

        try {
          const data = await res.json();
          errorText = data.message || errorText;
        } catch {
        }

        setPhotosMessage(errorText);
        return;
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      setSelectedPhotoUrl(objectUrl);
      setPhotosOpen(true);

      setTimeout(() => {
        const preview = document.getElementById("photo-preview");
        if (preview) {
          preview.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 50);
    } catch {
      setPhotosMessage("Netwerkfout bij ophalen van foto");
    } finally {
      setPhotoPreviewLoading(false);
    }
  }

  return (
    <main style={{ padding: "20px", fontFamily: "sans-serif" }}>
      {loading && <p>Boxdetail laden...</p>}
      {message && <p>{message}</p>}

      {!loading && !message && box && (
        <>
          <h1>{box.displayName}</h1>

          <p><strong>Site:</strong> {box.siteName}</p>
          <p><strong>Status:</strong> {box.status}</p>
          <p><strong>Laatste heartbeat:</strong> {box.lastHeartbeat || "Onbekend"}</p>

          <hr style={{ margin: "20px 0" }} />

          <p><strong>Connectiviteit:</strong> {box.connectivitySummary}</p>
          <p><strong>Hardware:</strong> {box.hardwareSummary}</p>

          <hr style={{ margin: "20px 0" }} />

          <p>
            <strong>Open mogelijk:</strong>{" "}
            {box.availableActions.open ? "Ja" : "Nee"}
          </p>
          <p>
            <strong>Close mogelijk:</strong>{" "}
            {box.availableActions.close ? "Ja" : "Nee"}
          </p>

          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <OpenBoxButton boxId={box.id} canOpen={box.availableActions.open} />
            <CloseBoxButton boxId={box.id} canClose={box.availableActions.close} />

            <Link href={`/portal/box-events?id=${encodeURIComponent(box.id)}`} style={actionButtonStyle}>
              HISTORIEK
            </Link>

            <Link href={`/portal/box-picture?id=${encodeURIComponent(box.id)}`} style={actionButtonStyle}>
              PICTURE
            </Link>

            <button
              type="button"
              onClick={() => setSharesOpen((current) => !current)}
              style={actionButtonStyle}
            >
              SHARES
            </button>

            <button
              type="button"
              onClick={() => setPhotosOpen((current) => !current)}
              style={actionButtonStyle}
            >
              FOTO'S
            </button>
          </div>

          <div style={{ marginTop: "16px" }}>
            <Link href="/" style={actionButtonStyle}>
              TERUG NAAR OVERZICHT
            </Link>
          </div>

          {sharesOpen && (
            <section style={{ marginTop: "24px" }}>
              <h2>Shares</h2>
              {sharesMessage && <p>{sharesMessage}</p>}

              <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "12px", marginBottom: "16px" }}>
                <h3 style={{ marginTop: 0 }}>Nieuwe share</h3>

                <p>
                  <input
                    value={sharePhoneNumber}
                    onChange={(e) => setSharePhoneNumber(e.target.value)}
                    placeholder="Gsm-nummer"
                    style={{ width: "100%", padding: "8px", marginBottom: "8px" }}
                  />
                </p>

                <p>
                  <input
                    value={shareLabel}
                    onChange={(e) => setShareLabel(e.target.value)}
                    placeholder="Naam of label"
                    style={{ width: "100%", padding: "8px", marginBottom: "8px" }}
                  />
                </p>

                <button
                  type="button"
                  onClick={() => void handleCreateShare()}
                  disabled={shareSubmitting}
                  style={{ padding: "8px 12px" }}
                >
                  {shareSubmitting ? "Opslaan..." : "Share aanmaken"}
                </button>
              </div>

              <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "12px" }}>
                <p>Bestaande sms-shares voor deze Gridbox.</p>

                {shares.length === 0 ? (
                  <p>Geen shares gevonden</p>
                ) : (
                  shares.map((item) => (
                    <div key={item.id} style={{ borderTop: "1px solid #eee", padding: "10px 0" }}>
                      <p><strong>ID:</strong> {item.id}</p>
                      <p><strong>Label:</strong> {item.label || "-"}</p>
                      <p><strong>Email:</strong> {item.email || "-"}</p>
                      <p><strong>Rol:</strong> {item.role || "-"}</p>
                      <p><strong>Actief:</strong> {item.active ? "Ja" : "Nee"}</p>
                      <p><strong>Toegevoegd door:</strong> {item.addedBy || "-"}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {photosOpen && (
            <section style={{ marginTop: "24px" }}>
              <h2>Foto's</h2>
              {photosMessage && <p>{photosMessage}</p>}

              <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "12px" }}>
                {photos.length === 0 ? (
                  <p>Geen foto's gevonden</p>
                ) : (
                  photos.map((item) => (
                    <div key={item.id} style={{ borderTop: "1px solid #eee", padding: "10px 0" }}>
                      <p><strong>Bestand:</strong> {item.filename}</p>
                      <p><strong>Updated:</strong> {item.updatedAt || "-"}</p>
                      <button
                        type="button"
                        onClick={() => void handleLoadPhoto(item.filename)}
                        disabled={photoPreviewLoading && selectedPhotoFilename === item.filename}
                        style={{ padding: "8px 12px" }}
                      >
                        {photoPreviewLoading && selectedPhotoFilename === item.filename ? "Laden..." : "Bekijk"}
                      </button>
                    </div>
                  ))
                )}
              </div>

              {selectedPhotoUrl && (
                <div
                  id="photo-preview"
                  style={{ marginTop: "16px", border: "1px solid #ccc", borderRadius: "8px", padding: "12px" }}
                >
                  <h3 style={{ marginTop: 0 }}>Preview - {selectedPhotoFilename}</h3>
                  <img
                    src={selectedPhotoUrl}
                    alt={selectedPhotoFilename}
                    style={{ maxWidth: "100%", height: "auto", display: "block" }}
                  />
                </div>
              )}
            </section>
          )}
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
