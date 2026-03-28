"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { apiUrl } from "@/lib/api";

type Props = {
  boxId: string;
  canOpen: boolean;
  canClose: boolean;
  onNotify: (msg: string) => void;
};

export default function SmartToggleButton({ boxId, canOpen, canClose, onNotify }: Props) {
  const derivedState = canClose ? "open" : "closed";
  const [currentState, setCurrentState] = useState<"closed" | "opening" | "open" | "closing">(derivedState);
  const [textMode, setTextMode] = useState<"light" | "dark">(derivedState === "open" ? "dark" : "light");

  useEffect(() => {
    if (currentState === "open" && canOpen && !canClose) {
        setCurrentState("closed");
        setTextMode("light");
    }
    if (currentState === "closed" && canClose && !canOpen) {
        setCurrentState("open");
        setTextMode("dark");
    }
  }, [canOpen, canClose, currentState]);

  async function handleToggle() {
    if (currentState === "closed") {
      setCurrentState("opening");
      onNotify("OPENING... ⏳");

      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(apiUrl(`/portal/boxes/${boxId}/open`), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("API Fout");

        setTimeout(() => setTextMode("dark"), 2500);

        setTimeout(() => {
          setCurrentState("open");
          onNotify("Gridbox is open! 🔓");
        }, 5000);

      } catch (e) {
        onNotify("Fout bij openen. ❌");
        setCurrentState("closed");
      }

    } else if (currentState === "open") {
      setCurrentState("closing");
      onNotify("CLOSING... ⏳");

      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(apiUrl(`/portal/boxes/${boxId}/close`), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("API Fout");

        setTimeout(() => setTextMode("light"), 2500);

        setTimeout(() => {
          setCurrentState("closed");
          onNotify("Gridbox is gesloten! 🔒");
        }, 5000);

      } catch (e) {
        onNotify("Fout bij sluiten. ❌");
        setCurrentState("open");
      }
    }
  }

  const isOpenClass = currentState === "opening" || currentState === "open" ? "is-open" : "";
  const isTextDarkClass = textMode === "dark" ? "is-open-text" : "";
  const isAnimating = currentState === "opening" || currentState === "closing";

  return (
    <>
      <button
        onClick={handleToggle}
        disabled={isAnimating || (!canOpen && !canClose)}
        className={`smart-btn ${isOpenClass} ${isTextDarkClass}`}
      >
        <div className="shutter"></div>
        <span className="btn-text">
          {currentState === "closed" && "OPEN BOX 🔓"}
          {currentState === "opening" && "OPENING... ⏳"}
          {currentState === "open" && "CLOSE BOX 🔒"}
          {currentState === "closing" && "CLOSING... ⏳"}
        </span>
      </button>

      <style jsx>{`
        .smart-btn {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 56px;
          min-width: 220px;
          padding: 0 24px;
          border-radius: 16px;
          font-size: 14px;
          font-weight: 900;
          border: none;
          overflow: hidden;
          cursor: pointer;
          background-color: #d1fae5;
          box-shadow: 0 8px 20px -4px rgba(16,185,129,0.5);
          transition: box-shadow 0.3s ease;
        }
        .smart-btn:disabled {
          cursor: not-allowed;
        }
        .smart-btn.is-open {
          box-shadow: none;
        }
        .shutter {
          position: absolute;
          top: 0; left: 0; right: 0; height: 100%;
          background-color: #10b981;
          background-image: repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(0,0,0,0.1) 4px, rgba(0,0,0,0.1) 8px);
          transform: translateY(0%);
          transition: transform 5s linear;
          z-index: 1;
        }
        .smart-btn.is-open .shutter {
          transform: translateY(-100%);
        }
        .btn-text {
          position: relative;
          z-index: 2;
          letter-spacing: 1px;
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