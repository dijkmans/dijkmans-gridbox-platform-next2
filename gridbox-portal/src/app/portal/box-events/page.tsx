"use client";

import { Suspense, useEffect, useState } from "react";
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
};

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("nl-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function capitalize(value: string) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getActionLabel(item: PortalEventItem) {
  if (item.type.startsWith("command_")) {
    return capitalize(item.type.replace("command_", "").toLowerCase());
  }

  if (item.type === "heartbeat") {
    return "Heartbeat";
  }

  if (item.type === "relay_open") {
    return "Relais open";
  }

  return capitalize(item.type.replaceAll("_", " ").toLowerCase());
}

function getSourceLabel(item: PortalEventItem) {
  const viaMatch = item.label.match(/ via (.+?) \(/i);

  if (viaMatch && viaMatch[1]) {
    return viaMatch[1].trim();
  }

  if (item.type.startsWith("command_")) {
    return "Onbekend";
  }

  return "Systeem";
}

function getStatusLabel(item: PortalEventItem) {
  const statusMatch = item.label.match(/\((.+?)\)$/);

  if (statusMatch && statusMatch[1]) {
    return capitalize(statusMatch[1].trim().toLowerCase());
  }

  if (item.severity === "error") {
    return "Fout";
  }

  if (item.severity === "warning") {
    return "Waarschuwing";
  }

  return "Info";
}

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

  const [events, setEvents] = useState<PortalEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadEvents() {
    try {
      setLoading(true);
      setMessage("");

      if (!boxId) {
        setEvents([]);
        setMessage("Geen box-id opgegeven");
        return;
      }

      const user = auth.currentUser;

      if (!user) {
        setEvents([]);
        setMessage("Meld je aan om historiek te bekijken");
        return;
      }

      const token = await user.getIdToken();

      const res = await fetch(apiUrl(`/portal/boxes/${boxId}/events`), {
        headers: {
          Authorization: `Bearer ${token}`
        },
        cache: "no-store"
      });

      const data = await res.json();

      if (!res.ok) {
        setEvents([]);
        setMessage(data.message || "Kon historiek niet ophalen");
        return;
      }

      setEvents(data.items || []);
    } catch {
      setEvents([]);
      setMessage("Netwerkfout bij ophalen van historiek");
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

      await loadEvents();
    });

    void loadEvents();

    return () => {
      active = false;
      unsubscribe();
    };
  }, [boxId]);

  return (
    <main style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Box historiek - {boxId || "-"}</h1>

      <div style={{ margin: "16px 0", display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <button type="button" onClick={() => void loadEvents()} style={{ padding: "8px 12px" }}>
          Refresh
        </button>

        {boxId && (
          <Link href={`/portal/box?id=${encodeURIComponent(boxId)}`} style={actionButtonStyle}>
            TERUG NAAR BOX
          </Link>
        )}
      </div>

      {loading && <p>Historiek laden...</p>}
      {message && <p>{message}</p>}

      {!loading && !message && (
        <div style={{ border: "1px solid #ccc", borderRadius: "8px", overflow: "hidden" }}>
          {events.length === 0 ? (
            <p style={{ padding: "12px", margin: 0 }}>Geen historiek gevonden</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "12px", borderBottom: "1px solid #ccc" }}>Tijdstip</th>
                  <th style={{ textAlign: "left", padding: "12px", borderBottom: "1px solid #ccc" }}>Actie</th>
                  <th style={{ textAlign: "left", padding: "12px", borderBottom: "1px solid #ccc" }}>Bron</th>
                  <th style={{ textAlign: "left", padding: "12px", borderBottom: "1px solid #ccc" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {events.map((item) => (
                  <tr key={item.id}>
                    <td style={{ padding: "12px", borderBottom: "1px solid #eee" }}>{formatTimestamp(item.timestamp)}</td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #eee" }}>{getActionLabel(item)}</td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #eee" }}>{getSourceLabel(item)}</td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #eee" }}>{getStatusLabel(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
