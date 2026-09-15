import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    host: "0.0.0.0",
    // Hosts usados pelo ambiente de preview; em produção o app é servido
    // pelo próprio domínio da loja, então isto não vaza nada.
    allowedHosts: true,
  },
});
