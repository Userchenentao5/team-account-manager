import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

/**
 * HMR-safe drizzle(better-sqlite3) singleton.
 *
 * better-sqlite3 is a native module → this file (and anything importing it)
 * must run on the Node runtime, never Edge (Pitfall 2). Do NOT mark this
 * module (or routes importing it) as the Edge runtime. The Database instance
 * is cached on globalThis in dev so Next.js HMR re-evaluation doesn't open new
 * handles.
 */
const globalForDb = globalThis as unknown as {
  sqlite?: Database.Database;
};

const sqlite =
  globalForDb.sqlite ??
  new Database(process.env.DB_FILE_NAME ?? "./data/app.db");

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON"); // SQLite needs FKs explicitly enabled per connection

if (process.env.NODE_ENV !== "production") {
  globalForDb.sqlite = sqlite;
}

export const db = drizzle({ client: sqlite, schema });
