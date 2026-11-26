import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  define: { "import.meta.env.VITE_VERCEL_HOST": JSON.stringify(process.env.VERCEL ?? ""), "import.meta.env.VITE_VERCEL_ENV": JSON.stringify(process.env.VERCEL_ENV ?? "") },
  test: { setupFiles: ["./tests/browser-locale.ts"] },
  build: {
    outDir: "dist/client",
    rolldownOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\\\/g, "/");
          if (
            normalized.includes("/src/lib/") ||
            normalized.includes("/src/hooks/") ||
            normalized.includes("/src/data/") ||
            normalized.includes("/node_modules/@noble/") ||
            normalized.includes("/node_modules/@phosphor-icons/")
          ) {
            return "shared";
          }
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
    proxy: { "/api": { target: "http://127.0.0.1:3001", changeOrigin: false } },
    warmup: {
      clientFiles: ["./src/main.tsx"],
    },
  },
  plugins: [react(), tailwindcss()],
});
