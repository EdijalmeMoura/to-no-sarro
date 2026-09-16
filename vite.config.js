import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Em dev: Vite na 5173 com proxy para a API/WS na 3001 (npm run dev:all).
// Em produção: `npm run build && npm start` — o Express serve o dist/ sozinho.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": "http://localhost:3001",
      "/ws": { target: "ws://localhost:3001", ws: true },
    },
  },
});
