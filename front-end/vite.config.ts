import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 4173,   // 5173 bloqué par Windows
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/monitoring/socket.io": {
        target: "http://localhost:8080",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});

