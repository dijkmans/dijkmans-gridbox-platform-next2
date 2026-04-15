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
  onActionComplete
}: Props) {
  const [isProcessing, setIsProcessing] = useState(false);

  async function handleToggle() {
    if (isProcessing || !canInteract) return;

    const action = isOpen ? "close" : "open";
    const actionLabel = isOpen ? "sluiten" : "openen";
    const fallbackName = boxName?.trim() ? boxName.trim() : boxId;

    try {
      setIsProcessing(true);
      onNotify(`Gridbox ${fallbackName} is aan het ${actionLabel}... ${"\u23F3"}`);

      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(apiUrl(`/portal/boxes/${boxId}/${action}`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error("API Fout");
      }

      await onActionComplete?.();
    } catch (error) {
      console.error(`[SmartToggleButton] Fout bij ${actionLabel}`, error);
      onNotify(`Fout bij ${actionLabel}. ${"\u274C"}`);
    } finally {
      setIsProcessing(false);
    }
  }

  const buttonText = isOpen ? "Sluiten" : "Openen";
  const buttonClass = isOpen
    ? "rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold px-4 py-3"
    : "rounded-xl bg-emerald-700 text-white text-sm font-semibold px-4 py-3";

  return (
    <button
      onClick={handleToggle}
      disabled={isProcessing || !canInteract}
      className={[
        "w-full flex items-center justify-center transition-opacity",
        buttonClass,
        isProcessing || !canInteract ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
      ].join(" ")}
    >
      {buttonText}
    </button>
  );
}
