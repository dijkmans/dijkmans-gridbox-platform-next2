import React from "react";
import { BoxGrid } from "../features/boxes/components/BoxGrid";

function App() {
  return (
    <div className="App">
      <header style={{ 
        backgroundColor: "#282c34", 
        padding: "20px", 
        color: "white", 
        textAlign: "center",
        marginBottom: "20px" 
      }}>
        <h1>Dijkmans Gridbox Platform</h1>
        <p>Real-time monitoring van uw grid-systemen</p>
      </header>
      <main>
        <BoxGrid />
      </main>
    </div>
  );
}

export default App;
