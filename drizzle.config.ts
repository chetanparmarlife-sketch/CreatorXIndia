import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL ?? "";

export default defineConfig({
  out: "./supabase/migrations",
  schema: "./packages/schema/src/index.ts",
  dialect: "postgresql",
  driver: "postgres-js",
  dbCredentials: {
    url: connectionString,
    connectionString,
  } as { url: string; connectionString: string },
});
