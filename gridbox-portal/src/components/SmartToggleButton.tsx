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

  const buttonText = isOpen ? `CLOSE ${"\u{1F512}"}` : `OPEN ${"\u{1F513}"}`;

  return (
    <button
      onClick={handleToggle}
      disabled={isProcessing || !canInteract}
      className={[
        "relative flex items-center justify-center h-[46px] w-full overflow-hidden rounded-xl",
        "border-none text-sm font-black whitespace-nowrap",
        "bg-emerald-100 transition-opacity",
        isOpen ? "shadow-none" : "shadow-[0_8px_18px_-4px_rgba(16,185,129,0.45)]",
        isProcessing ? "opacity-60" : "",
        !canInteract ? "cursor-not-allowed" : "cursor-pointer"
      ].join(" ")}
    >
      <div className={`smart-btn-shutter${isOpen ? " smart-btn-shutter-open" : ""}`} />
      <span className={`smart-btn-text ${isOpen ? "text-emerald-800" : "text-white"}`}>
        {buttonText}
      </span>
    </button>
  );
}
