import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: path.resolve(import.meta.dirname),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@creatorx/schema": path.resolve(import.meta.dirname, "..", "..", "packages", "schema", "src"),
      "@creatorx/types": path.resolve(import.meta.dirname, "..", "..", "packages", "types", "src"),
      "@creatorx/api-client": path.resolve(import.meta.dirname, "..", "..", "packages", "api-client", "src"),
      "@creatorx/design-tokens": path.resolve(import.meta.dirname, "..", "..", "packages", "design-tokens", "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  base: "./",
  build: {
    outDir: path.resolve(import.meta.dirname, "..", "server", "dist", "public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      allow: [path.resolve(import.meta.dirname, "..", "..")],
      deny: ["**/.*"],
    },
  },
});
