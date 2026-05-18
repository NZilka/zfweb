import { env } from "~/env";
import * as schema from "./schema";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";

// Explicit .env.local load for the rare case this module is imported outside
// Next.js's runtime (e.g. ad-hoc scripts). Inside Next.js this is a no-op
// because process.env is already populated by the framework.
config({ path: ".env.local" });

const sql = neon(env.DATABASE_URL);
export const db = drizzle(sql, { schema });
