import React from "react";
import { getFirestore, collection, addDoc } from "firebase/firestore";

export const BoxCard = ({ box }) => {
  let displayStatus = box.status;
  let isOnline = false;

  // 1. Status Logica
  if (typeof displayStatus === "string") {
    isOnline = displayStatus.toLowerCase() === "online";
  } else if (typeof displayStatus === "object" && displayStatus !== null) {
    if (displayStatus.door || displayStatus.lock) {
      displayStatus = `Deur: ${displayStatus.door || "?"} | Slot: ${displayStatus.lock || "?"}`;
    } else {
      displayStatus = "Systeem data";
    }
    isOnline = box.status.online === true || box.status.state === "online";
  }

  // 2. Slimme Datum & Offline Logica
  let lastSeenText = "Onbekend";
  let timeSource = box.last_seen || box.updatedAt || (box.software && box.software.lastHeartbeatIso);
  let isReallyOnline = isOnline;

  if (timeSource) {
    try {
      let dateObj = (typeof timeSource === "object" && timeSource.seconds) 
        ? new Date(timeSource.seconds * 1000) 
        : new Date(timeSource);
      
      lastSeenText = dateObj.toLocaleString("nl-NL", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
      });

      const now = new Date();
      const diffInMinutes = Math.floor((now - dateObj) / (1000 * 60));

      if (diffInMinutes > 10) {
        isReallyOnline = false;
        if (typeof displayStatus === "string" && displayStatus.toLowerCase() === "online") {
          displayStatus = `Offline (${diffInMinutes} min. geleden)`;
        }
      }
    } catch (e) {
      isReallyOnline = false;
    }
  } else {
    isReallyOnline = false; 
  }

  // 3. Acties
  const handleCommand = async (commandName) => {
    try {
      const db = getFirestore();
      const commandsRef = collection(db, "boxes", box.id, "commands");
      await addDoc(commandsRef, {
        command: commandName,
        status: "pending",
        source: "Web Dashboard",
        createdAt: new Date().toISOString()
      });
      alert(`Commando ${commandName} verzonden!`);
    } catch (error) {
      alert("Fout: " + error.message);
    }
  };

  const handleShares = () => {
    alert(`Shares menu voor ${box.name || box.id} openen... (functie in ontwikkeling)`);
  };

  return (
    <div style={{
      border: "1px solid #e0e0e0",
      borderRadius: "12px",
      padding: "20px",
      boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
      backgroundColor: "#ffffff",
      color: "#333",
      display: "flex",
      flexDirection: "column",
      gap: "12px"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: "1.2rem" }}>
          {box.name || box.id}
        </h3>
        <span style={{
          width: "14px", height: "14px", borderRadius: "50%",
          backgroundColor: isReallyOnline ? "#4caf50" : "#f44336",
          boxShadow: isReallyOnline ? "0 0 8px rgba(76, 175, 80, 0.6)" : "0 0 8px rgba(244, 67, 54, 0.4)"
        }}></span>
      </div>
      
      <div style={{ fontSize: "0.95rem" }}>
        <p style={{ margin: "0 0 6px 0", color: isReallyOnline ? "#333" : "#d32f2f" }}>
          <strong>Status:</strong> {typeof displayStatus === "string" ? displayStatus : "Onbekend"}
        </p>
        <p style={{ margin: 0, color: "#666", fontSize: "0.85rem" }}>
          Laatst gezien: {lastSeenText}
        </p>
      </div>

      {/* Knoppen Groep */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
        {isReallyOnline && (
          <div style={{ display: "flex", gap: "8px" }}>
            <button 
              onClick={() => handleCommand("OPEN")}
              style={{ flex: 1, padding: "10px", backgroundColor: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: "8px", cursor: "pointer", color: "#2e7d32", fontWeight: "bold" }}>
              OPENEN
            </button>
            <button 
              onClick={() => handleCommand("CLOSE")}
              style={{ flex: 1, padding: "10px", backgroundColor: "#ffebee", border: "1px solid #ef9a9a", borderRadius: "8px", cursor: "pointer", color: "#c62828", fontWeight: "bold" }}>
              SLUITEN
            </button>
          </div>
        )}
        
        <button 
          onClick={handleShares}
          style={{ 
            width: "100%", padding: "10px", backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1", 
            borderRadius: "8px", cursor: "pointer", color: "#475569", fontWeight: "bold" 
          }}>
          SHARES
        </button>
      </div>

      <div style={{ marginTop: "auto", paddingTop: "12px", borderTop: "1px solid #f0f0f0" }}>
        <p style={{ fontSize: "0.75rem", color: "#aaa", margin: 0, fontFamily: "monospace" }}>
          ID: {box.id}
        </p>
      </div>
    </div>
  );
};
