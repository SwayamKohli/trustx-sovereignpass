// SQLite Database Connection & Initialization
// Owner: Sanchit (Role 3 — Core Backend & Identity Lifecycle Lead)

import Database from 'better-sqlite3';
import path from 'path';
import { createSchema } from './schema';
import { initializeAuditIntegrity } from '../services/audit-integrity';

const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, '../../../trustx.db');

let dbInstance: Database.Database | null = null;

/**
 * Initializes and returns the SQLite database instance.
 * Enables foreign key constraints and creates the schema idempotently.
 */
export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('busy_timeout = 5000');
    // Explicitly enable SQLite foreign key constraints
    dbInstance.pragma('foreign_keys = ON');
    // Run schema creation idempotently
    createSchema(dbInstance);

    // Idempotent migrations for existing databases
    const migrations = [
      'ALTER TABLE sessions ADD COLUMN dpop_public_key TEXT',
      'ALTER TABLE sessions ADD COLUMN login_risk TEXT',
      'ALTER TABLE sessions ADD COLUMN is_kiosk INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE sessions ADD COLUMN ip_address TEXT NOT NULL DEFAULT "127.0.0.1"',
      'ALTER TABLE sessions ADD COLUMN user_agent TEXT NOT NULL DEFAULT "unknown"',
      'ALTER TABLE sessions ADD COLUMN last_active_at INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE recovery_codes ADD COLUMN consumed_at TEXT',
      'ALTER TABLE kiosk_authorizations ADD COLUMN dpop_public_key TEXT',
      'ALTER TABLE kiosk_authorizations ADD COLUMN credential_id TEXT',
      'ALTER TABLE delegation_intents ADD COLUMN session_id TEXT',
      'ALTER TABLE delegation_intents ADD COLUMN intent_hash TEXT',
      'ALTER TABLE delegation_intents ADD COLUMN token_hash TEXT',
    ];
    for (const sql of migrations) {
      try {
        dbInstance.exec(sql);
      } catch {
        // Column already exists or table not ready
      }
    }
    dbInstance.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_delegation_token_hash ON delegation_intents(token_hash)');
    initializeAuditIntegrity(dbInstance);
  }
  return dbInstance;
}

export function initDb(): Database.Database {
  return getDb();
}

export const db = getDb();

export default db;
export * from './schema';
