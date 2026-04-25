import express from 'express';
import type { Express } from 'express';
import fs from "node:fs";
import path from "node:path";

const currentDir = typeof __dirname !== "undefined"
  ? __dirname
  : path.resolve(process.cwd(), "apps/server/dist");

export function serveStatic(app: Express) {
  const distPath = path.resolve(currentDir, "public");
  if (!fs.existsSync(distPath)) {
    console.warn(`Static build directory not found: ${distPath}. Serving API routes only.`);
    return;
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
