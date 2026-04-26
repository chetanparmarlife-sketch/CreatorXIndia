import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@creatorx/schema": path.resolve(import.meta.dirname, "..", "..", "packages", "schema", "src"),
      "@creatorx/ui": path.resolve(import.meta.dirname, "..", "..", "packages", "ui", "src"),
      "@creatorx/design-tokens": path.resolve(import.meta.dirname, "..", "..", "packages", "design-tokens", "src"),
    },
  },
  build: {
    outDir: "dist",
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
