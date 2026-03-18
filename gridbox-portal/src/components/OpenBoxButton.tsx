"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

type OpenBoxButtonProps = {
  boxId: string;
  canOpen: boolean;
};

type CommandResponse = {
  commandId: string;
};

type CommandDetail = {
  id: string;
  command: string;
  status: string;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStatusColor(status: string) {
  if (status === "completed") return "green";
  if (status === "failed") return "red";
  if (status === "pending") return "orange";
  if (status === "started") return "orange";
  return "gray";
}

export default function OpenBoxButton({ boxId, canOpen }: OpenBoxButtonProps) {
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [commandStatus, setCommandStatus] = useState("");

  async function pollCommand(commandId: string): Promise<void> {
    const user = auth.currentUser;

    if (!user) {
      setMessage("Niet aangemeld");
      return;
    }

    const token = await user.getIdToken();

    for (let i = 0; i < 15; i++) {
      const res = await fetch(`http://localhost:8080/portal/boxes/${boxId}/commands/${commandId}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        await wait(1500);
        continue;
      }

      const data: CommandDetail = await res.json();
      const normalizedStatus = String(data.status || "").toLowerCase();

      setCommandStatus(normalizedStatus);

      if (normalizedStatus === "completed") {
        setMessage("Box succesvol geopend");

        setTimeout(() => {
          router.refresh();
        }, 1000);

        return;
      }

      if (normalizedStatus === "failed") {
        setMessage("Open-commando is mislukt");
        return;
      }

      if (normalizedStatus === "pending") {
        setMessage("Commando staat in wachtrij...");
      } else {
        setMessage("Open-commando wordt uitgevoerd...");
      }

      await wait(1500);
    }

    setMessage("Nog geen bevestiging ontvangen. Controleer de box of probeer later opnieuw.");
  }

  async function handleOpen() {
    if (busy || !canOpen) {
      return;
    }

    try {
      setBusy(true);
      setMessage("");
      setCommandStatus("");

      const user = auth.currentUser;

      if (!user) {
        setMessage("Niet aangemeld");
        return;
      }

      const token = await user.getIdToken();

      const res = await fetch(`http://localhost:8080/portal/boxes/${boxId}/open`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Openen mislukt");
        return;
      }

      const typed = data as CommandResponse;

      if (!typed.commandId) {
        setMessage("Geen command-id ontvangen");
        return;
      }

      setMessage("Commando verstuurd...");
      await pollCommand(typed.commandId);
    } catch (error) {
      setMessage("Netwerkfout bij openen");
    } finally {
      setBusy(false);
    }
  }

  const buttonLabel = busy ? "Bezig..." : "Open box";

  return (
    <div style={{ marginTop: "12px" }}>
      <button
        onClick={handleOpen}
        disabled={!canOpen || busy}
        style={{
          padding: "10px 16px",
          cursor: !canOpen || busy ? "not-allowed" : "pointer",
          opacity: !canOpen || busy ? 0.6 : 1
        }}
      >
        {buttonLabel}
      </button>

      {message && (
        <p style={{ marginTop: "10px" }}>
          {message}
        </p>
      )}

      {commandStatus && (
        <p style={{ marginTop: "6px" }}>
          <strong>Laatste command-status:</strong>{" "}
          <span style={{ color: getStatusColor(commandStatus) }}>
            {commandStatus}
          </span>
        </p>
      )}
    </div>
  );
}
