"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { apiUrl } from "@/lib/api";

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

  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadPicture() {
    try {
      setLoading(true);
      setMessage("");

      if (!boxId) {
        setImageUrl("");
        setMessage("Geen box-id opgegeven");
        return;
      }

      const user = auth.currentUser;

      if (!user) {
        setImageUrl("");
        setMessage("Meld je aan om picture te bekijken");
        return;
      }

      const token = await user.getIdToken();

      const res = await fetch(apiUrl(`/portal/boxes/${boxId}/picture`), {
        headers: {
          Authorization: `Bearer ${token}`
        },
        cache: "no-store"
      });

      if (!res.ok) {
        let errorText = "Kon picture niet ophalen";

        try {
          const data = await res.json();
          errorText = data.message || errorText;
        } catch {
        }

        setImageUrl("");
        setMessage(errorText);
        return;
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      setImageUrl((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous);
        }

        return objectUrl;
      });
    } catch {
      setImageUrl("");
      setMessage("Netwerkfout bij ophalen van picture");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    const unsubscribe = auth.onAuthStateChanged(async () => {
      if (!active) {
        return;
      }

      await loadPicture();
    });

    void loadPicture();

    return () => {
      active = false;
      unsubscribe();

      setImageUrl((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous);
        }

        return "";
      });
    };
  }, [boxId]);

  return (
    <main style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Box picture - {boxId || "-"}</h1>

      <div style={{ margin: "16px 0", display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <button type="button" onClick={() => void loadPicture()} style={{ padding: "8px 12px" }}>
          Refresh
        </button>

        {boxId && (
          <Link href={`/portal/box?id=${encodeURIComponent(boxId)}`} style={actionButtonStyle}>
            TERUG NAAR BOX
          </Link>
        )}
      </div>

      {loading && <p>Picture laden...</p>}
      {message && <p>{message}</p>}

      {!loading && !message && imageUrl && (
        <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "12px" }}>
          <img
            src={imageUrl}
            alt={`Snapshot van ${boxId}`}
            style={{ maxWidth: "100%", height: "auto", display: "block" }}
          />
        </div>
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
