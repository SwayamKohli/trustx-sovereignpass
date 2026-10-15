// Admin SOC Live Incident Event Stream Component
// Owner: Ananya (Role 2 — Product, UI/UX & Admin SOC Lead)
import type { AuditEvent } from '../services/types';
export function AuditFeed({ logs }: { logs: AuditEvent[] }) {
  return logs.length === 0 ? <p>No security events returned.</p> : <ol className="audit-feed">{logs.map(log => <li key={log.id}>
    <div className="section-heading"><strong>{log.eventType.replaceAll('_', ' ')}</strong><time dateTime={log.timestamp}>{new Date(log.timestamp).toISOString()}</time></div>
    <p>{log.userId ?? 'Unknown account'}{log.ipAddress ? ` · ${log.ipAddress}` : ''}</p>
    <details><summary>Event details</summary><pre>{JSON.stringify(log.details, null, 2)}</pre></details>
  </li>)}</ol>;
}
