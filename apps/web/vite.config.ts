import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    strictPort: true,
    headers: {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    },
    proxy: {
      "/api": {
        target: "http://localhost:4000",
      },
      "/socket.io": {
        target: "http://localhost:4000",
        ws: true,
      },
      "/terminal": {
        target: "http://localhost:4002",
        ws: true,
      },
      "/preview": {
        target: "http://localhost:4002",
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
