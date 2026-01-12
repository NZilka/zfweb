import { env } from "~/env";
import * as schema from "./schema";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";

config();

const sql = neon(env.DATABASE_URL);
export const db = drizzle(sql, { schema });

//export const db = drizzle(sql, { schema });

// import { drizzle } from "drizzle-orm/postgres-js";
// import { sql } from "@vercel/postgres";
// import * as schema from "./schema";

// // // Use this object to send drizzle queries to your DB
// export const db = drizzle(sql, { schema });
