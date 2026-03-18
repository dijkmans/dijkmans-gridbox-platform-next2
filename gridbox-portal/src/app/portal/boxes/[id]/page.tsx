"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import OpenBoxButton from "@/components/OpenBoxButton";
import { auth } from "@/lib/firebase";

type BoxDetail = {
  id: string;
  displayName: string;
  siteName: string;
  status: string;
  lastHeartbeat?: string;
  lastSeen?: string;
  connectivitySummary: string;
  hardwareSummary: string;
  availableActions: {
    open: boolean;
  };
};

export default function BoxDetailPage() {
  const params = useParams<{ id: string }>();
  const boxId = params.id;

  const [box, setBox] = useState<BoxDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadBox() {
      try {
        setLoading(true);
        setMessage("");

        const user = auth.currentUser;

        if (!user) {
          if (active) {
            setBox(null);
            setMessage("Meld je aan om boxdetails te bekijken");
          }
          return;
        }

        const token = await user.getIdToken();

        const res = await fetch(`http://localhost:8080/portal/boxes/${boxId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          },
          cache: "no-store"
        });

        const data = await res.json();

        if (!res.ok) {
          if (active) {
            setBox(null);
            setMessage(data.message || "Kon boxdetail niet ophalen");
          }
          return;
        }

        if (active) {
          setBox(data as BoxDetail);
        }
      } catch (error) {
        if (active) {
          setBox(null);
          setMessage("Netwerkfout bij ophalen van boxdetail");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    const unsubscribe = auth.onAuthStateChanged(() => {
      loadBox();
    });

    loadBox();

    return () => {
      active = false;
      unsubscribe();
    };
  }, [boxId]);

  return (
    <main style={{ padding: "20px", fontFamily: "sans-serif" }}>
      {loading && <p>Boxdetail laden...</p>}
      {message && <p>{message}</p>}

      {!loading && !message && box && (
        <>
          <h1>{box.displayName}</h1>

          <p><strong>Site:</strong> {box.siteName}</p>
          <p><strong>Status:</strong> {box.status}</p>
          <p><strong>Laatste heartbeat:</strong> {box.lastHeartbeat || "Onbekend"}</p>

          <hr style={{ margin: "20px 0" }} />

          <p><strong>Connectiviteit:</strong> {box.connectivitySummary}</p>
          <p><strong>Hardware:</strong> {box.hardwareSummary}</p>

          <hr style={{ margin: "20px 0" }} />

          <p>
            <strong>Open mogelijk:</strong>{" "}
            {box.availableActions.open ? "Ja" : "Nee"}
          </p>

          <OpenBoxButton boxId={box.id} canOpen={box.availableActions.open} />
        </>
      )}
    </main>
  );
}