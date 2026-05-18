// Load .env.local explicitly. drizzle-kit doesn't know about Next.js's env
// file loading order, so without this it would only see plain .env. Loading
// .env.local matches what Next.js dev/build see, so `pnpm db:push` and the
// running app always agree on DATABASE_URL.
import { config } from "dotenv";
config({ path: ".env.local" });

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  tablesFilter: ["zfweb_*"],
});
