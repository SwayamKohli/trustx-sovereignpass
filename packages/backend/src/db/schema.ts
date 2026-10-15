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
  created_at TEXT NOT NULL,
  consumed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_recovery_user ON recovery_codes(user_id, used);

-- 4. Two-Phase Safe Recovery Staging Table
CREATE TABLE IF NOT EXISTS pending_recoveries (
  ticket_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verified_recovery_code_id TEXT NOT NULL REFERENCES recovery_codes(id),
  replacement_registration_challenge TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0 CHECK(used IN (0, 1))
);
CREATE INDEX IF NOT EXISTS idx_pending_rec_lookup ON pending_recoveries(ticket_id, used, expires_at);

-- 5. Authenticated Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT REFERENCES credentials(id),
  created_at TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  is_kiosk INTEGER NOT NULL DEFAULT 0 CHECK(is_kiosk IN (0, 1)),
  dpop_public_key TEXT,
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  last_active_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

-- 6. Shared-Device Kiosk Session Authorizations
CREATE TABLE IF NOT EXISTS kiosk_authorizations (
  kiosk_session_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  kiosk_client_secret_hash TEXT NOT NULL,
  display_code INTEGER NOT NULL,
  user_id TEXT REFERENCES users(id),
  challenge TEXT UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('PENDING', 'AUTHORIZED', 'EXPIRED', 'CLAIMED')) DEFAULT 'PENDING',
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_kiosk_lookup ON kiosk_authorizations(kiosk_session_id, status, expires_at);

-- 7. Step-Up Action Authorizations
CREATE TABLE IF NOT EXISTS step_up_authorizations (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  http_method TEXT NOT NULL,
  route TEXT NOT NULL,
  intent_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0 CHECK(consumed IN (0, 1))
);
CREATE INDEX IF NOT EXISTS idx_step_up_lookup ON step_up_authorizations(token, consumed, expires_at);

-- 8. AI Delegation Intents Table
CREATE TABLE IF NOT EXISTS delegation_intents (
  intent_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  recipient TEXT NOT NULL,
  max_amount REAL NOT NULL,
  nonce TEXT NOT NULL,
  challenge TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PENDING', 'AUTHORIZED', 'CONSUMED', 'EXPIRED')) DEFAULT 'PENDING',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_delegation_user ON delegation_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_delegation_lookup ON delegation_intents(intent_id, status, expires_at);

-- 9. Security & Identity Lifecycle Audit Events Table
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
  // Idempotent migration for existing SQLite databases
  try {
    db.exec(`ALTER TABLE sessions ADD COLUMN dpop_public_key TEXT;`);
  } catch {
    // Column already exists
  }
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
  consumed_at: string | null;
}

export interface PendingRecovery {
  ticket_id: string;
  user_id: string;
  verified_recovery_code_id: string;
  replacement_registration_challenge: string;
  expires_at: number;
  used: 0 | 1;
}

export interface Session {
  id: string;
  user_id: string;
  credential_id: string | null;
  created_at: string;
  expires_at: number;
  is_kiosk: 0 | 1;
  dpop_public_key?: string | null;
  ip_address: string;
  user_agent: string;
  last_active_at: number;
}

export interface KioskAuthorization {
  kiosk_session_id: string;
  token_hash: string;
  kiosk_client_secret_hash: string;
  display_code: number;
  user_id: string | null;
  challenge: string | null;
  status: 'PENDING' | 'AUTHORIZED' | 'EXPIRED' | 'CLAIMED';
  expires_at: number;
  created_at: string;
}

export interface StepUpAuthorization {
  token: string;
  user_id: string;
  session_id: string;
  http_method: string;
  route: string;
  intent_hash: string;
  expires_at: number;
  consumed: 0 | 1;
}

export interface DelegationIntentRow {
  intent_id: string;
  user_id: string;
  action: string;
  recipient: string;
  max_amount: number;
  nonce: string;
  challenge: string;
  expires_at: number;
  status: 'PENDING' | 'AUTHORIZED' | 'CONSUMED' | 'EXPIRED';
  created_at: string;
}

export interface AuditEvent {
  id: string;
  type: string;
  user_id: string | null;
  detail: string | null;
  timestamp: string;
}
