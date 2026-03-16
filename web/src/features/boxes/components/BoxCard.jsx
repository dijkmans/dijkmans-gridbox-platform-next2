import React from "react";

export const BoxCard = ({ box }) => {
  let displayStatus = box.status;

  // Maak complexe data leesbaar
  if (typeof displayStatus === "object" && displayStatus !== null) {
    if (displayStatus.door || displayStatus.lock) {
      // Oude sensor data netjes vertalen
      displayStatus = `Deur: ${displayStatus.door || "onbekend"} | Slot: ${displayStatus.lock || "onbekend"}`;
    } else {
      displayStatus = "Systeem data ontvangen"; // Fallback voor andere gekke objecten
    }
  }

  return (
    <div style={{
      border: "1px solid #ccc",
      borderRadius: "8px",
      padding: "16px",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      backgroundColor: "white",
      color: "black",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      overflow: "hidden",       // Zorgt dat tekst NOOIT meer buiten het kaartje breekt
      textOverflow: "ellipsis"  // Zet puntjes (...) als het toch te lang is
    }}>
      <h3 style={{ margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {box.name || box.id}
      </h3>
      <p style={{ margin: 0 }}>
        <strong>Status:</strong> {displayStatus || "Geen status bekend"}
      </p>
      <p style={{ fontSize: "0.8em", color: "gray", margin: 0 }}>ID: {box.id}</p>
    </div>
  );
};
