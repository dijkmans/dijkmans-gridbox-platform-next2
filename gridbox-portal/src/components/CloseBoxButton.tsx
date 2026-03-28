"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { apiUrl } from "@/lib/api";

type Props = { boxId: string; canClose: boolean; onNotify: (msg: string) => void; };

export default function CloseBoxButton({ boxId, canClose, onNotify }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClose() {
    if (!canClose || loading) return;
    setLoading(true);
    onNotify("Sluit-commando verzonden...");
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch(apiUrl(`/portal/boxes/${boxId}/close`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) onNotify("Gridbox veilig gesloten. 🔒");
      else onNotify("Fout bij sluiten. ❌");
    } catch { onNotify("Netwerkfout. ⚠️"); }
    finally { setLoading(false); }
  }

  return (
    <button
      onClick={() => void handleClose()}
      disabled={!canClose || loading}
      style={{
        minWidth: "160px", height: "48px", borderRadius: "12px", border: "1px solid #e2e8f0",
        backgroundColor: "#fff", color: "#334155", fontWeight: "700", fontSize: "13px",
        cursor: canClose ? "pointer" : "not-allowed", transition: "all 0.2s ease"
      }}
    >
      {loading ? "BEZIG..." : "CLOSE BOX"}
    </button>
  );
}