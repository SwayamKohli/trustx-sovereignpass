import crypto from 'crypto';
import type Database from 'better-sqlite3';
const genesis = '0'.repeat(64);
export function hashAudit(previous: string, id: string, type: string, user: string | null, timestamp: string, detail: string | null): string {
  return crypto.createHash('sha256').update(`${previous}|${id}|${type}|${user ?? ''}|${timestamp}|${detail ?? ''}`).digest('hex');
}
export function initializeAuditIntegrity(database: Database.Database): void {
  database.function('trustx_audit_hash', { deterministic: true }, hashAudit);
  database.transaction(() => {
  const exists = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'audit_chain'").get();
  database.exec(`CREATE TABLE IF NOT EXISTS audit_chain (sequence INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT UNIQUE NOT NULL, previous_hash TEXT NOT NULL, hash TEXT NOT NULL)`);
  // Baseline pre-existing history once. Later reads compare stored anchors rather than rebuilding them.
  if (!exists) {
    database.transaction(() => {
      let previous = genesis;
      const rows = database.prepare('SELECT * FROM audit_events ORDER BY rowid').all() as { id: string; type: string; user_id: string | null; timestamp: string; detail: string | null }[];
      for (const row of rows) {
        const hash = hashAudit(previous, row.id, row.type, row.user_id, row.timestamp, row.detail);
        database.prepare('INSERT INTO audit_chain (event_id, previous_hash, hash) VALUES (?, ?, ?)').run(row.id, previous, hash);
        previous = hash;
      }
    })();
  }
  database.exec(`CREATE TRIGGER IF NOT EXISTS audit_anchor_insert AFTER INSERT ON audit_events BEGIN
    INSERT INTO audit_chain (event_id, previous_hash, hash)
    VALUES (NEW.id,
      COALESCE((SELECT hash FROM audit_chain ORDER BY sequence DESC LIMIT 1), '${genesis}'),
      trustx_audit_hash(COALESCE((SELECT hash FROM audit_chain ORDER BY sequence DESC LIMIT 1), '${genesis}'), NEW.id, NEW.type, NEW.user_id, NEW.timestamp, NEW.detail));
  END`);
  })();
}
