import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "src", // We vertellen Vite dat onze code in /src staat
  build: {
    outDir: "../dist",
  }
});
