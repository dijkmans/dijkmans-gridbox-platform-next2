import React from "react";

/**
 * Een visueel kaartje dat de status van een Gridbox toont.
 */
export const BoxCard = ({ box }) => {
  const statusColor = box.status === "online" ? "#4caf50" : "#f44336";

  return (
    <div style={{
      border: "1px solid #ddd",
      borderRadius: "8px",
      padding: "16px",
      margin: "8px",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      borderTop: `4px solid ${statusColor}`
    }}>
      <h3 style={{ margin: "0 0 8px 0" }}>{box.name || "Naamloze Box"}</h3>
      <p><strong>Status:</strong> <span style={{ color: statusColor }}>{box.status || "onbekend"}</span></p>
      <p><small>ID: {box.id}</small></p>
    </div>
  );
};
