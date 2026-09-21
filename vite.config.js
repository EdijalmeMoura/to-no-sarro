import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "robots.txt"],
      manifest: {
        name: "TÔ NO SARRO! — Smart Food",
        short_name: "Sarro",
        description: "Burgers artesanais — Delivery, Balcão e Salão",
        theme_color: "#F58200",
        background_color: "#050505",
        display: "standalone",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.qrserver\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "qr-cache", expiration: { maxEntries: 50, maxAgeSeconds: 60*60*24*7 } }
          },
          {
            urlPattern: /^\/api\/.*/i,
            handler: "NetworkFirst",
            options: { cacheName: "api-cache", networkTimeoutSeconds: 3, expiration: { maxEntries: 50, maxAgeSeconds: 60*5 } }
          }
        ]
      }
    })
  ],
  base: "./",
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": "http://localhost:3001",
      "/img-up": "http://localhost:3001",
      "/ws": { target: "ws://localhost:3001", ws: true },
    },
  },
});
