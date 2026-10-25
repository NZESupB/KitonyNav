import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  build: {
    outDir: "dist/client",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("/node_modules/")) return;
          if (id.includes("/lunar-typescript/")) return "calendar";
          if (id.includes("/radix-ui/") || id.includes("/@radix-ui/")) return "radix";
          if (id.includes("/lucide-react/") || id.includes("/react-icons/")) return "icons";
          if (/\/(motion|framer-motion|motion-dom|motion-utils)\//.test(id)) return "motion";
          return "vendor";
        },
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    proxy: {
      "/api": "http://127.0.0.1:8080",
    },
    warmup: {
      clientFiles: ["./src/main.tsx"],
    },
  },
  plugins: [react()],
});
