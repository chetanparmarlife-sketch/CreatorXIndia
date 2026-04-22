import "dotenv/config";
import type { Request, Response, Express } from "express";
import { createApp } from "../server/app";

let appPromise: Promise<Express> | null = null;

async function getApp() {
  if (!appPromise) {
    appPromise = createApp().then(({ app }) => app);
  }
  return appPromise;
}

export default async function handler(req: Request, res: Response) {
  const app = await getApp();
  return app(req, res);
}
