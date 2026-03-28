"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { apiUrl } from "@/lib/api";

type Props = { boxId: string; canOpen: boolean; onNotify: (msg: string) => void; };

export default function OpenBoxButton({ boxId, canOpen, onNotify }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    if (!canOpen || loading) return;
    setLoading(true);
    onNotify("Open-commando verzonden...");
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch(apiUrl(`/portal/boxes/${boxId}/open`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) onNotify("Gridbox succesvol geopend! ✅");
      else onNotify("Fout bij openen. ❌");
    } catch { onNotify("Netwerkfout. ⚠️"); } 
    finally { setLoading(false); }
  }

  return (
    <button
      onClick={() => void handleOpen()}
      disabled={!canOpen || loading}
      style={{
        minWidth: "160px", height: "48px", borderRadius: "12px", border: "none",
        backgroundColor: canOpen ? "#10b981" : "#f1f5f9", color: "#fff",
        fontWeight: "700", fontSize: "13px", cursor: canOpen ? "pointer" : "not-allowed",
        transition: "all 0.2s ease", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)"
      }}
    >
      {loading ? "BEZIG..." : "OPEN BOX"}
    </button>
  );
}