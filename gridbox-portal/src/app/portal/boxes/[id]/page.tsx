"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import OpenBoxButton from "@/components/OpenBoxButton";
import CloseBoxButton from "@/components/CloseBoxButton";
import { auth } from "@/lib/firebase";

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

export default function BoxDetailPage() {
  const params = useParams<{ id: string }>();
  const boxId = params.id;

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
          fetch(`http://localhost:8080/portal/boxes/${boxId}`, {
            headers: {
              Authorization: `Bearer ${token}`
            },
            cache: "no-store"
          }),
          fetch(`http://localhost:8080/portal/boxes/${boxId}/shares`, {
            headers: {
              Authorization: `Bearer ${token}`
            },
            cache: "no-store"
          }),
          fetch(`http://localhost:8080/portal/boxes/${boxId}/photos`, {
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

    const sharesRes = await fetch(`http://localhost:8080/portal/boxes/${boxId}/shares`, {
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

    const photosRes = await fetch(`http://localhost:8080/portal/boxes/${boxId}/photos`, {
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

      const createRes = await fetch(`http://localhost:8080/portal/boxes/${boxId}/shares`, {
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
        `http://localhost:8080/portal/boxes/${boxId}/photos/content?filename=${encodeURIComponent(filename)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          },
          cache: "no-store"
        }
      );

      if (!res.ok) {
        let errorMessage = "Kon foto niet ophalen";

        try {
          const data = await res.json();
          errorMessage = data.message || errorMessage;
        } catch {
        }

        setPhotosMessage(errorMessage);
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

            <Link href={`/portal/boxes/${box.id}/events`} style={actionButtonStyle}>
              HISTORIEK
            </Link>

            <Link href={`/portal/boxes/${box.id}/picture`} style={actionButtonStyle}>
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
              FOTO&apos;S
            </button>
          </div>

          {sharesOpen && (
            <>
              <hr style={{ margin: "20px 0" }} />

              <h2>Delen met eindklant</h2>
              <p>Bestaande sms-shares voor deze Gridbox.</p>

              <div
                style={{
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                  padding: "12px",
                  marginTop: "12px",
                  marginBottom: "12px",
                  display: "grid",
                  gap: "10px"
                }}
              >
                <input
                  value={sharePhoneNumber}
                  onChange={(e) => setSharePhoneNumber(e.target.value)}
                  placeholder="Gsm-nummer, bv +32471234567"
                  style={{ padding: "8px" }}
                />
                <input
                  value={shareLabel}
                  onChange={(e) => setShareLabel(e.target.value)}
                  placeholder="Optioneel label of opmerking"
                  style={{ padding: "8px" }}
                />
                <div>
                  <button
                    type="button"
                    onClick={handleCreateShare}
                    disabled={shareSubmitting}
                    style={{ padding: "8px 12px" }}
                  >
                    {shareSubmitting ? "Bezig..." : "Delen"}
                  </button>
                </div>
              </div>

              {sharesMessage && <p>{sharesMessage}</p>}

              {!sharesMessage && shares.length === 0 && (
                <p>Geen shares gevonden.</p>
              )}

              {shares.length > 0 && (
                <div style={{ display: "grid", gap: "12px", marginTop: "12px" }}>
                  {shares.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        border: "1px solid #ccc",
                        borderRadius: "8px",
                        padding: "12px"
                      }}
                    >
                      <p><strong>GSM / id:</strong> {item.id}</p>
                      <p><strong>Type:</strong> {item.typeGuess || "-"}</p>
                      <p><strong>Status:</strong> {item.active ? "Actief" : "Niet actief"}</p>
                      <p><strong>Label:</strong> {item.label || "-"}</p>
                      <p><strong>Email:</strong> {item.email || "-"}</p>
                      <p><strong>Rol:</strong> {item.role || "-"}</p>
                      <p><strong>Toegevoegd door:</strong> {item.addedBy || "-"}</p>
                      <p><strong>Aangemaakt op:</strong> {item.createdAt || "-"}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {photosOpen && (
            <>
              <hr style={{ margin: "20px 0" }} />

              <h2>Foto&apos;s</h2>
              <p>Opgeslagen snapshots tijdens open en kort daarna.</p>

              {photosMessage && <p>{photosMessage}</p>}

              {!photosMessage && photos.length === 0 && (
                <p>Geen foto&apos;s gevonden.</p>
              )}

              {photoPreviewLoading && (
                <p style={{ marginTop: "16px" }}>Foto laden...</p>
              )}

              {selectedPhotoUrl && !photoPreviewLoading && (
                <div
                  id="photo-preview"
                  style={{
                    marginTop: "16px",
                    marginBottom: "16px",
                    border: "1px solid #ccc",
                    borderRadius: "8px",
                    padding: "12px"
                  }}
                >
                  <p><strong>Geselecteerd:</strong> {selectedPhotoFilename}</p>
                  <img
                    src={selectedPhotoUrl}
                    alt={selectedPhotoFilename}
                    style={{
                      maxWidth: "100%",
                      height: "auto",
                      border: "1px solid #ccc",
                      borderRadius: "8px"
                    }}
                  />
                </div>
              )}

              {photos.length > 0 && (
                <div style={{ display: "grid", gap: "12px", marginTop: "12px" }}>
                  {photos.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        border: "1px solid #ccc",
                        borderRadius: "8px",
                        padding: "12px"
                      }}
                    >
                      <p><strong>Bestand:</strong> {item.filename}</p>
                      <p><strong>Updated:</strong> {item.updatedAt || "-"}</p>
                      <p><strong>Grootte:</strong> {item.size || "-"}</p>
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            void handleLoadPhoto(item.filename);
                          }}
                          style={{ padding: "8px 12px" }}
                        >
                          Toon foto
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}