import React from "react";

export const BoxCard = ({ box }) => {
  let displayStatus = box.status;
  let isOnline = false;

  // 1. Status Logica (Bedenk of hij online is)
  if (typeof displayStatus === "string") {
    isOnline = displayStatus.toLowerCase() === "online";
  } else if (typeof displayStatus === "object" && displayStatus !== null) {
    if (displayStatus.door || displayStatus.lock) {
      displayStatus = `Deur: ${displayStatus.door || "?"} | Slot: ${displayStatus.lock || "?"}`;
    } else {
      displayStatus = "Systeem data";
    }
    // Als er in de oude objecten een "online: true" stond, pakken we die mee
    isOnline = box.status.online === true || box.status.state === "online";
  }

  // 2. Datum Logica (Maak Firebase tijd leesbaar)
  let lastSeenText = "Onbekend";
  if (box.last_seen) {
    try {
      // Firebase slaat tijd vaak op als een object met "seconds"
      let dateObj = box.last_seen.seconds 
        ? new Date(box.last_seen.seconds * 1000) 
        : new Date(box.last_seen);
      
      // Nederlandse notatie: bijv. "16 mrt 17:30"
      lastSeenText = dateObj.toLocaleString("nl-NL", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
      });
    } catch (e) {
      console.error("Datum parse fout", e);
    }
  }

  // 3. Het Design
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
      {/* Header met Titel en Bolletje */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: "1.2rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {box.name || box.id}
        </h3>
        <span style={{
          display: "inline-block",
          width: "14px",
          height: "14px",
          borderRadius: "50%",
          backgroundColor: isOnline ? "#4caf50" : "#f44336",
          boxShadow: isOnline ? "0 0 8px rgba(76, 175, 80, 0.6)" : "0 0 8px rgba(244, 67, 54, 0.4)",
          flexShrink: 0
        }} title={isOnline ? "Apparaat is Online" : "Apparaat is Offline / Onbekend"}></span>
      </div>
      
      {/* Inhoud */}
      <div style={{ fontSize: "0.95rem" }}>
        <p style={{ margin: "0 0 6px 0" }}>
          <strong>Status:</strong> {typeof displayStatus === "string" ? displayStatus : "Onbekend"}
        </p>
        <p style={{ margin: 0, color: "#666", fontSize: "0.85rem" }}>
          ? Laatst gezien: {lastSeenText}
        </p>
      </div>

      {/* Footer met ID */}
      <div style={{ marginTop: "auto", paddingTop: "12px", borderTop: "1px solid #f0f0f0" }}>
        <p style={{ fontSize: "0.75rem", color: "#aaa", margin: 0, fontFamily: "monospace" }}>
          ID: {box.id}
        </p>
      </div>
    </div>
  );
};
