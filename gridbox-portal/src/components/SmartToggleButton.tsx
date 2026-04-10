"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { apiUrl } from "@/lib/api";

type Props = {
  boxId: string;
  boxName?: string;
  isOpen: boolean;
  canInteract: boolean;
  onNotify: (msg: string) => void;
  onActionComplete?: () => void | Promise<void>;
};

export default function SmartToggleButton({
  boxId,
  boxName,
  isOpen,
  canInteract,
  onNotify,
  onActionComplete,
}: Props) {
  const [isProcessing, setIsProcessing] = useState(false);

  async function handleToggle() {
    if (isProcessing || !canInteract) return;

    const action = isOpen ? "close" : "open";
    const actionLabel = isOpen ? "sluiten" : "openen";
    const fallbackName = boxName?.trim() ? boxName.trim() : boxId;

    try {
      setIsProcessing(true);
      onNotify(`${fallbackName} is aan het ${actionLabel}...`);

      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(apiUrl(`/portal/boxes/${boxId}/${action}`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("API fout");

      await onActionComplete?.();
    } catch (error) {
      console.error(`[SmartToggleButton] Fout bij ${actionLabel}`, error);
      onNotify(`Fout bij ${actionLabel}.`);
    } finally {
      setIsProcessing(false);
    }
  }

  const disabled = isProcessing || !canInteract;

  if (isOpen) {
    return (
      <button
        onClick={handleToggle}
        disabled={disabled}
        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isProcessing ? "Bezig..." : "Sluiten"}
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={disabled}
      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isProcessing ? "Bezig..." : "Openen"}
    </button>
  );
}
