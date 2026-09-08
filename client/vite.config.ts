import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dev server proxies /api and /socket.io to the backend so the browser
// sees everything as same-origin — no CORS, and cookies behave exactly as
// they will in production once the client and API are served from the same
// domain (see DEPLOYMENT.md for recommended hosting topology).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:4000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:4000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
