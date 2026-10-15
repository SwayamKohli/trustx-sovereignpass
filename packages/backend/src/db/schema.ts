// SQLite Database Schema Definition & Integrity Constraints
// Owner: Sanchit (Role 3 — Core Backend & Identity Lifecycle Lead)

import type Database from 'better-sqlite3';

export const SCHEMA_SQL = `
-- Enforce foreign keys
PRAGMA foreign_keys = ON;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('USER', 'ADMIN')) DEFAULT 'USER',
  created_at TEXT NOT NULL
);

-- 2. WebAuthn Credentials Table
CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key BLOB NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  device_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'REVOKED')) DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL,
  last_used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_credentials_user ON credentials(user_id, status);

-- 3. Recovery Codes Table
CREATE TABLE IF NOT EXISTS recovery_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0 CHECK(used IN (0, 1)),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recovery_user ON recovery_codes(user_id, used);

-- 4. Authenticated Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT REFERENCES credentials(id),
  created_at TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

-- 5. Security & Identity Lifecycle Audit Events Table
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  detail TEXT,
  timestamp TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_events(user_id);
`;

/**
 * Executes the database schema migration idempotently.
 */
export function createSchema(db: Database.Database): void {
  db.exec(SCHEMA_SQL);
}

// Entity TypeScript Types
export interface User {
  id: string;
  username: string;
  role: 'USER' | 'ADMIN';
  created_at: string;
}

export interface Credential {
  id: string;
  user_id: string;
  public_key: Buffer;
  counter: number;
  transports: string | null;
  device_name: string;
  status: 'ACTIVE' | 'REVOKED';
  created_at: string;
  last_used_at: string | null;
}

export interface RecoveryCode {
  id: string;
  user_id: string;
  code_hash: string;
  used: 0 | 1;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  credential_id: string | null;
  created_at: string;
  expires_at: number;
}

export interface AuditEvent {
  id: string;
  type: string;
  user_id: string | null;
  detail: string | null;
  timestamp: string;
}
