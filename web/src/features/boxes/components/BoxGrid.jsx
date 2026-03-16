import React from "react";
import { useBoxes } from "../hooks/useBoxes";
import { BoxCard } from "./BoxCard";

/**
 * Een overzicht van alle gridboxen in een grid-layout.
 */
export const BoxGrid = () => {
  const { boxes, loading, error } = useBoxes();

  if (loading) return <p>Boxen laden...</p>;
  if (error) return <p style={{ color: "red" }}>Fout: {error}</p>;
  if (boxes.length === 0) return <p>Geen boxen gevonden in Firestore.</p>;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
      gap: "16px",
      padding: "16px"
    }}>
      {boxes.map(box => (
        <BoxCard key={box.id} box={box} />
      ))}
    </div>
  );
};
