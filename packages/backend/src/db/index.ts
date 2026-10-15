// SQLite Database Connection & Initialization
// Owner: Sanchit (Role 3 — Core Backend & Identity Lifecycle Lead)

import Database from 'better-sqlite3';
import path from 'path';
import { createSchema } from './schema';

const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, '../../../trustx.db');

let dbInstance: Database.Database | null = null;

/**
 * Initializes and returns the SQLite database instance.
 * Enables foreign key constraints and creates the schema idempotently.
 */
export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    // Explicitly enable SQLite foreign key constraints
    dbInstance.pragma('foreign_keys = ON');
    // Run schema creation idempotently
    createSchema(dbInstance);
  }
  return dbInstance;
}

export function initDb(): Database.Database {
  return getDb();
}

export const db = getDb();

export default db;
export * from './schema';
