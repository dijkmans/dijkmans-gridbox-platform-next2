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

  const isOpenClass = isOpen ? "is-open" : "";
  const isTextDarkClass = isOpen ? "is-open-text" : "";
  
  // Tekst compacter gemaakt voor een betere layout naast de Cockpit knop
  const buttonText = isOpen ? `CLOSE ${"\u{1F512}"}` : `OPEN ${"\u{1F513}"}`;

  return (
    <>
      <button
        onClick={handleToggle}
        disabled={isProcessing || !canInteract}
        className={`smart-btn ${isOpenClass} ${isTextDarkClass} ${isProcessing ? "is-processing" : ""}`}
      >
        <div className="shutter"></div>
        <span className="btn-text">{buttonText}</span>
      </button>

      <style jsx>{`
        .smart-btn {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 46px;
          width: 100%;
          padding: 0 12px;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 900;
          border: none;
          overflow: hidden;
          cursor: pointer;
          background-color: #d1fae5;
          box-shadow: 0 8px 18px -4px rgba(16,185,129,0.45);
          transition: box-shadow 0.3s ease, opacity 0.2s ease;
          white-space: nowrap;
        }
        .smart-btn:disabled {
          cursor: not-allowed;
        }
        .smart-btn.is-processing {
          opacity: 0.65;
        }
        .smart-btn.is-open {
          box-shadow: none;
        }
        .shutter {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 100%;
          background-color: #10b981;
          background-image: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 4px,
            rgba(0,0,0,0.1) 4px,
            rgba(0,0,0,0.1) 8px
          );
          transform: translateY(0%);
          transition: transform 0.35s ease;
          z-index: 1;
        }
        .smart-btn.is-open .shutter {
          transform: translateY(-100%);
        }
        .btn-text {
          position: relative;
          z-index: 2;
          letter-spacing: 0.8px;
          color: #ffffff;
          transition: color 0.3s ease;
        }
        .smart-btn.is-open-text .btn-text {
          color: #065f46;
        }
      `}</style>
    </>
  );
}
