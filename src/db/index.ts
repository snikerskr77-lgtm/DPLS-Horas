import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

// Deteta se estamos na Vercel (serverless) ou local
// Na Vercel usa driver serverless do Neon via HTTP
// Localmente usa pg Pool normal (TCP)
const isServerless =
  !!process.env.VERCEL ||
  !!process.env.VERCEL_ENV ||
  databaseUrl.includes("neon.tech") ||
  databaseUrl.includes("supabase.co");

function createDb() {
  if (isServerless) {
    // Neon serverless HTTP driver — funciona na Vercel Edge e Serverless
    const sql = neon(databaseUrl!);
    return drizzleNeon(sql);
  } else {
    // Node.js pg Pool — funciona localmente
    const globalForDb = globalThis as typeof globalThis & {
      __pool?: Pool;
    };

    const pool =
      globalForDb.__pool ??
      new Pool({ connectionString: databaseUrl });

    if (process.env.NODE_ENV !== "production") {
      globalForDb.__pool = pool;
    }

    return drizzleNode(pool);
  }
}

export const db = createDb();
