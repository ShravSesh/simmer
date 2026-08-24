import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "Simmer — swipe right on dinner",
        short_name: "Simmer",
        description: "Swipe recipes generated from your pantry",
        theme_color: "#12B76A",
        background_color: "#FFFCF5",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        navigateFallback: "/index.html",
        runtimeCaching: [
          { urlPattern: /^https:\/\/fonts\.googleapis\.com/, handler: "StaleWhileRevalidate", options: { cacheName: "google-fonts-css" } },
          { urlPattern: /^https:\/\/fonts\.gstatic\.com/, handler: "CacheFirst", options: { cacheName: "google-fonts-files", expiration: { maxEntries: 20, maxAgeSeconds: 31536000 } } }
        ]
      }
    })
  ]
});
