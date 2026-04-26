import { defineConfig } from "drizzle-kit";
import { config as loadEnv } from "dotenv";

loadEnv({ path: "apps/server/.env" });

export default defineConfig({
  out: "./supabase/migrations",
  schema: "./packages/schema/src/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
