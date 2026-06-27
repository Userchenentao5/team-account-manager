import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";

/**
 * Programmatic migration runner (Success Criterion 4).
 *
 * Applies the committed Drizzle migrations in ./drizzle to the SQLite file.
 * foreign_keys is enabled on the migrate connection too (Open Question 3) so
 * FK constraints are honoured during DDL. Idempotent: re-running only applies
 * not-yet-applied migrations.
 */
const dbFile = process.env.DB_FILE_NAME ?? "./data/app.db";
mkdirSync(dirname(dbFile), { recursive: true });

const sqlite = new Database(dbFile);
sqlite.pragma("foreign_keys = ON");
const db = drizzle({ client: sqlite });

migrate(db, { migrationsFolder: "./drizzle" });
console.log("migrations applied");
sqlite.close();
