"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

type CloseBoxButtonProps = {
  boxId: string;
  canClose: boolean;
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

export default function CloseBoxButton({ boxId, canClose }: CloseBoxButtonProps) {
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
        setMessage("Box succesvol gesloten");

        setTimeout(() => {
          router.refresh();
        }, 1000);

        return;
      }

      if (normalizedStatus === "failed") {
        setMessage("Close-commando is mislukt");
        return;
      }

      if (normalizedStatus === "pending") {
        setMessage("Commando staat in wachtrij...");
      } else {
        setMessage("Close-commando wordt uitgevoerd...");
      }

      await wait(1500);
    }

    setMessage("Nog geen bevestiging ontvangen. Controleer de box of probeer later opnieuw.");
  }

  async function handleClose() {
    if (busy || !canClose) {
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

      const res = await fetch(`http://localhost:8080/portal/boxes/${boxId}/close`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Sluiten mislukt");
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
      setMessage("Netwerkfout bij sluiten");
    } finally {
      setBusy(false);
    }
  }

  const buttonLabel = busy ? "Bezig..." : "Close box";

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start" }}>
      <button
        type="button"
        onClick={handleClose}
        disabled={!canClose || busy}
        style={{
          display: "inline-block",
          padding: "8px 12px",
          border: "1px solid #ccc",
          borderRadius: "6px",
          background: "#fff",
          color: "inherit",
          cursor: !canClose || busy ? "not-allowed" : "pointer",
          opacity: !canClose || busy ? 0.6 : 1
        }}
      >
        {buttonLabel}
      </button>

      {message && (
        <p style={{ marginTop: "10px", marginBottom: 0 }}>
          {message}
        </p>
      )}

      {commandStatus && (
        <p style={{ marginTop: "6px", marginBottom: 0 }}>
          <strong>Laatste command-status:</strong>{" "}
          <span style={{ color: getStatusColor(commandStatus) }}>
            {commandStatus}
          </span>
        </p>
      )}
    </div>
  );
}