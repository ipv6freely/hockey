import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // ../shared lives outside this package's root (client/) — no separate
    // shared package now that this isn't an npm workspace, so Vite's dev
    // server needs an explicit allowance to read those files.
    fs: { allow: [".."] },
    proxy: {
      "/api": {
        target: process.env.SERVER_URL ?? "http://127.0.0.1:4322",
        changeOrigin: true,
      },
    },
  },
});
