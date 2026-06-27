import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

/**
 * Test DB harness (Wave 0).
 *
 * Opens a fresh in-memory better-sqlite3 database, enables foreign-key
 * enforcement (OFF by default per SQLite connection), applies the generated
 * Drizzle migrations from ./drizzle, and returns a drizzle instance plus the
 * raw sqlite handle so tests can close it in afterEach/afterAll.
 *
 * Each call yields an isolated `:memory:` DB so tests never share state.
 */
export function createTestDb(migrationsFolder = "./drizzle") {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder });
  return { db, sqlite };
}

export type TestDb = ReturnType<typeof createTestDb>["db"];
