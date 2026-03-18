"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AuthPanel from "@/components/AuthPanel";
import { auth } from "@/lib/firebase";

type PortalBox = {
  id: string;
  displayName: string;
  siteId: string;
  siteName: string;
  status: "online" | "offline" | "warning" | "unknown";
  lastHeartbeat?: string;
  canOpen: boolean;
  links: {
    detail: string;
    history?: string;
  };
};

type PortalBoxesResponse = {
  items: PortalBox[];
  count: number;
  mode: string;
};

function getStatusColor(status: string) {
  if (status === "online") return "green";
  if (status === "offline") return "red";
  if (status === "warning") return "orange";
  return "gray";
}

export default function Home() {
  const [boxes, setBoxes] = useState<PortalBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadBoxes() {
      try {
        setLoading(true);
        setMessage("");

        const user = auth.currentUser;

        if (!user) {
          if (active) {
            setBoxes([]);
            setMessage("Meld je aan om boxen te bekijken");
          }
          return;
        }

        const token = await user.getIdToken();

        const res = await fetch("http://localhost:8080/portal/boxes", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const data = await res.json();

        if (!res.ok) {
          if (active) {
            setBoxes([]);
            setMessage(data.message || "Kon boxen niet ophalen");
          }
          return;
        }

        if (active) {
          const typed = data as PortalBoxesResponse;
          setBoxes(typed.items);
        }
      } catch (error) {
        if (active) {
          setBoxes([]);
          setMessage("Netwerkfout bij ophalen van boxen");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    const unsubscribe = auth.onAuthStateChanged(() => {
      loadBoxes();
    });

    loadBoxes();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return (
    <main style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Gridbox Portal</h1>
      <p>Overzicht van alle boxen</p>

      <AuthPanel />

      {loading && <p>Boxen laden...</p>}
      {message && <p>{message}</p>}

      <div style={{ marginTop: "20px" }}>
        {boxes.map((box) => (
          <Link key={box.id} href={box.links.detail} style={{ textDecoration: "none" }}>
            <div
              style={{
                border: "1px solid #ccc",
                padding: "12px",
                marginBottom: "12px",
                borderRadius: "8px",
                cursor: "pointer"
              }}
            >
              <h2 style={{ margin: "0 0 8px 0" }}>{box.displayName}</h2>

              <p>
                <strong>Site:</strong> {box.siteName}
              </p>

              <p>
                <strong>Status:</strong>{" "}
                <span style={{ color: getStatusColor(box.status) }}>
                  {box.status}
                </span>
              </p>

              <p>
                <strong>Laatste heartbeat:</strong>{" "}
                {box.lastHeartbeat || "Onbekend"}
              </p>

              <p>
                <strong>Open mogelijk:</strong>{" "}
                {box.canOpen ? "Ja" : "Nee"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
