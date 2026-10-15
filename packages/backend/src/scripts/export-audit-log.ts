import { db } from '../db/index';
import { hashAudit } from '../services/audit-integrity';

export function buildAuditLedger() {
  const rows = db.prepare(`
    SELECT c.sequence AS 'index', c.event_id, c.previous_hash AS prev_hash, c.hash,
           a.id, a.type, a.user_id, a.detail, a.timestamp
    FROM audit_chain c LEFT JOIN audit_events a ON a.id = c.event_id ORDER BY c.sequence
  `).all() as { index: number; event_id: string; prev_hash: string; hash: string; id: string | null; type: string; user_id: string | null; detail: string | null; timestamp: string }[];
  let previous = '0'.repeat(64);
  let isTamperFree = true;
  for (const row of rows) {
    if (!row.id || row.prev_hash !== previous || hashAudit(previous, row.event_id, row.type, row.user_id, row.timestamp, row.detail) !== row.hash) isTamperFree = false;
    previous = row.hash;
  }
  const unanchored = db.prepare('SELECT COUNT(*) AS count FROM audit_events a LEFT JOIN audit_chain c ON a.id = c.event_id WHERE c.event_id IS NULL').get() as { count: number };
  return { ledger: rows, isTamperFree: isTamperFree && unanchored.count === 0 };
}
if (require.main === module) {
  const { ledger, isTamperFree } = buildAuditLedger();
  console.log(`Audit events: ${ledger.length}; stored hash chain: ${isTamperFree ? 'INTACT' : 'TAMPER DETECTED'}`);
  console.log('Local tamper evidence since the initial baseline; not protection against an attacker rewriting the entire database and its anchors.');
}
