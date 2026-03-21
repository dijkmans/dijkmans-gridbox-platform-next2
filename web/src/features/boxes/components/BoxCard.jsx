import React, { useState } from "react";
import { getFirestore, doc, setDoc } from "firebase/firestore";

export const BoxCard = ({ box }) => {
  const [showShareForm, setShowShareForm] = useState(false);
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  
  const displayStatus = box.status;
  const isOpen = box.state?.boxIsOpen === true;

  // 1. Offline Detector
  let lastSeenText = "Onbekend";
  let isReallyOnline = false;
  const timeSource = box.last_seen || box.updatedAt || box.software?.lastHeartbeatIso;

  if (timeSource) {
    const dateObj = (typeof timeSource === "object" && timeSource.seconds) 
      ? new Date(timeSource.seconds * 1000) : new Date(timeSource);
    lastSeenText = dateObj.toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const diffInMinutes = Math.floor((new Date() - dateObj) / (1000 * 60));
    isReallyOnline = (diffInMinutes <= 15);
  }

  // 2. Actie: Share opslaan in Firestore
  const handleSaveShare = async (e) => {
    e.preventDefault();
    if (!phone) return alert("Vul a.u.b. een GSM nummer in");
    
    setLoading(true);
    try {
      const db = getFirestore();
      // We gebruiken het telefoonnummer als Document ID, net als in je screenshot
      const shareRef = doc(db, "boxes", box.id, "shares", phone.trim());
      
      await setDoc(shareRef, {
        name: comment, // We slaan het commentaar op in het "name" veld
        status: "active",
        createdAt: new Date().toISOString(),
        addedBy: "Web Dashboard"
      });

      alert(`Toegang voor ${phone} succesvol opgeslagen!`);
      setPhone("");
      setComment("");
      setShowShareForm(false);
    } catch (error) {
      console.error("Fout bij opslaan:", error);
      alert("Fout: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      border: "1px solid #e0e0e0", borderRadius: "12px", padding: "20px",
      boxShadow: "0 4px 6px rgba(0,0,0,0.05)", backgroundColor: "#ffffff",
      display: "flex", flexDirection: "column", gap: "12px"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: "1.2rem" }}>{box.name || box.id}</h3>
        <span style={{
          width: "14px", height: "14px", borderRadius: "50%",
          backgroundColor: isReallyOnline ? "#4caf50" : "#f44336",
          boxShadow: isReallyOnline ? "0 0 8px rgba(76, 175, 80, 0.6)" : "0 0 8px rgba(244, 67, 54, 0.4)"
        }}></span>
      </div>
      
      <div style={{ fontSize: "0.85rem", color: "#666" }}>
        <p style={{ margin: "0 0 4px 0" }}>
          <strong>Status:</strong> <span style={{color: isReallyOnline ? "#2e7d32" : "#d32f2f"}}>
            {isReallyOnline ? (isOpen ? "OPEN" : "DICHT") : "OFFLINE"}
          </span>
        </p>
        <p style={{ margin: 0 }}>Gezien: {lastSeenText}</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {isReallyOnline && (
          <div style={{ display: "flex", gap: "8px" }}>
            <button style={{ flex: 1, padding: "10px", backgroundColor: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: "8px", color: "#2e7d32", fontWeight: "bold", cursor: "pointer" }}>OPENEN</button>
            <button style={{ flex: 1, padding: "10px", backgroundColor: "#ffebee", border: "1px solid #ef9a9a", borderRadius: "8px", color: "#c62828", fontWeight: "bold", cursor: "pointer" }}>SLUITEN</button>
          </div>
        )}
        
        <button 
          onClick={() => setShowShareForm(!showShareForm)}
          style={{ 
            width: "100%", padding: "10px", backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1", 
            borderRadius: "8px", cursor: "pointer", color: "#475569", fontWeight: "bold" 
          }}>
          SHARES
        </button>
      </div>

      {/* Formulier voor nieuwe share */}
      {showShareForm && (
        <form onSubmit={handleSaveShare} style={{ 
          marginTop: "10px", padding: "15px", backgroundColor: "#f8fafc", 
          borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "10px"
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: "bold", color: "#64748b" }}>GSM NUMMER</label>
            <input 
              type="text" placeholder="+32..." value={phone} 
              onChange={(e) => setPhone(e.target.value)}
              style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: "bold", color: "#64748b" }}>COMMENTS</label>
            <input 
              type="text" placeholder="Naam of reden" value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            />
          </div>
          <button 
            type="submit" disabled={loading}
            style={{ 
              marginTop: "5px", padding: "10px", backgroundColor: "#3b82f6", color: "white", 
              border: "none", borderRadius: "6px", fontWeight: "bold", cursor: loading ? "not-allowed" : "pointer" 
            }}>
            {loading ? "BEZIG..." : "OPSLAAN"}
          </button>
        </form>
      )}

      <div style={{ marginTop: "auto", paddingTop: "12px", borderTop: "1px solid #f0f0f0" }}>
        <p style={{ fontSize: "0.7rem", color: "#ccc", margin: 0, fontFamily: "monospace" }}>ID: {box.id}</p>
      </div>
    </div>
  );
};
