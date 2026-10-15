// Admin SOC Security Operations Center Dashboard View
// Owner: Ananya (Role 2 — Product, UI/UX & Admin SOC Lead)
import { useState } from 'react';
import { adminCredentials, adminLogs, adminSessions, attackReport, friendlyError, mockMode, runAttacks, terminateSession, verifyChain } from '../services/api';
import type { ActiveSession, AttackReport, ChainReport, User } from '../services/types';
import { expiryMilliseconds } from '../services/types';
import { usePolling } from '../services/usePolling';
import { AuditFeed } from '../components/AuditFeed';
import { Dialog } from '../components/Dialog';
export function AdminSOCPage({ user }: { user: User }) {
  return user.role === 'ADMIN' ? <SOC /> : <section><h1>Administrator access required</h1></section>;
}
function SOC() {
  const credentials = usePolling(adminCredentials);
  const sessions = usePolling(adminSessions);
  const logs = usePolling(adminLogs);
  const report = usePolling(attackReport, 10_000);
  const [manualReport, setManualReport] = useState<AttackReport>();
  const [chain, setChain] = useState<ChainReport>();
  const [target, setTarget] = useState<ActiveSession>();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const latestReport = manualReport && (!report.data || Date.parse(manualReport.timestamp) >= Date.parse(report.data.timestamp)) ? manualReport : report.data;
  async function action(name: string, operation: () => Promise<void>) {
    if (busy) return;
    setBusy(name); setError(''); setMessage('');
    try { await operation(); } catch (err) { setError(friendlyError(err)); } finally { setBusy(''); }
  }
  return <section>
    <div className="section-heading"><div><p className="eyebrow">Security operations</p><h1>Sessions, incidents & evidence</h1></div><button className="secondary" onClick={() => { credentials.refresh(); sessions.refresh(); logs.refresh(); report.refresh(); }}>Refresh data</button></div>
    <p>Sessions and events refresh every 5 seconds. Probe reports refresh every 10 seconds. Cached values may be stale when a refresh fails.</p>
    {mockMode && <p className="banner">All accounts and events here are preview data. No live security tests are executed.</p>}
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status">{message}</p>}
    <div className="stats"><div><span>Credentials returned</span><strong>{credentials.data?.credentials.length ?? '—'}</strong></div><div><span>Sessions returned</span><strong>{sessions.data?.sessions.length ?? '—'}</strong></div><div><span>Audit events returned</span><strong>{logs.data?.logs.length ?? '—'}</strong></div></div>
    <section className="panel"><h2>Credential inventory</h2>{credentials.error && <p role="alert" className="error">{credentials.error} Previously loaded data may be stale.</p>}
      {!credentials.data ? <p>{credentials.error ? 'Credential data unavailable.' : 'Loading credentials…'}</p> : <div className="table-scroll"><table><caption>Registered passkeys across accounts</caption><thead><tr><th scope="col">Account</th><th scope="col">Device</th><th scope="col">Credential</th><th scope="col">Status</th></tr></thead><tbody>{credentials.data.credentials.map(item => <tr key={item.id}><td>{item.username}</td><td>{item.deviceName}</td><td className="identifier">{item.id}</td><td><span className={`badge ${item.status.toLowerCase()}`}>{item.status}</span></td></tr>)}</tbody></table>{credentials.data.credentials.length === 0 && <p>No enrolled credentials.</p>}</div>}
    </section>
    <section className="panel"><h2>Active sessions</h2>{sessions.error && <p role="alert" className="error">{sessions.error} Previously loaded data may be stale.</p>}
      {!sessions.data ? <p>{sessions.error ? 'Session data unavailable.' : 'Loading sessions…'}</p> : <div className="table-scroll"><table><caption>Server sessions</caption><thead><tr><th scope="col">Account</th><th scope="col">Context</th><th scope="col">Expires</th><th scope="col">Action</th></tr></thead><tbody>{sessions.data.sessions.map(item => <tr key={item.sessionId}><td>{item.username}<small className="identifier">{item.sessionId}</small></td><td>{item.isKiosk ? 'Public kiosk' : 'Personal device'}<small>{item.ipAddress}</small><small>{item.userAgent}</small></td><td>{new Date(expiryMilliseconds(item.expiresAt)).toLocaleString()}</td><td><button className="secondary" disabled={!!busy} onClick={() => { setError(''); setTarget(item); }} aria-label={`Terminate session for ${item.username}`}>Terminate</button></td></tr>)}</tbody></table>{sessions.data.sessions.length === 0 && <p>No active sessions.</p>}</div>}
    </section>
    <section className="panel"><div className="section-heading"><h2>Attack probe evidence</h2><button disabled={!!busy} onClick={() => void action('probes', async () => { setManualReport(await runAttacks()); setMessage(mockMode ? 'Preview report loaded. All probes skipped; no tests ran.' : 'Server attack report received.'); })}>{busy === 'probes' ? 'Waiting for server results…' : 'Execute live attack runner'}</button></div>
      <p>Eight probes are expected for Evaluation 2. Counts below are computed only from the returned report.</p>
      {report.error && <p role="alert" className="error">{report.error} Live probe evidence is unavailable; an earlier report may be stale.</p>}
      {!latestReport ? <p>No verified report has been received. No pass count is claimed.</p> : <>
        <p>Report: {latestReport.runId} · <time>{latestReport.timestamp}</time></p>
        <p className="report-counts">Reported: {latestReport.probes.length} · PASS: {latestReport.probes.filter(probe => probe.status === 'PASS').length} · FAIL: {latestReport.probes.filter(probe => probe.status === 'FAIL').length} · SKIPPED: {latestReport.probes.filter(probe => probe.status === 'SKIPPED').length}</p>
        {latestReport.probes.length !== 8 && <p className="error">This report does not contain all eight expected probes.</p>}
        <ul className="probe-list">{latestReport.probes.map(probe => <li key={probe.id}><span className={`badge ${probe.status.toLowerCase()}`}>{probe.status}</span><strong>{probe.name}</strong><p>{probe.detail}</p></li>)}</ul>
      </>}
    </section>
    <section className="panel"><div className="section-heading"><h2>Tamper-evident audit chain</h2><button className="secondary" disabled={!!busy} onClick={() => void action('chain', async () => { setChain(undefined); setChain(await verifyChain()); })}>{busy === 'chain' ? 'Verifying…' : 'Verify chain on server'}</button></div>
      {chain ? <p role="status">{chain.intact ? 'Server verification: INTACT' : 'Server verification: BROKEN'} · {chain.checkedEvents} events checked · {chain.verifiedAt}</p> : <p>Unverified. No integrity claim is made until the server returns a verification result.</p>}
    </section>
    <section className="panel"><h2>Security event stream</h2>{logs.error && <p role="alert" className="error">{logs.error} Previously loaded events may be stale.</p>}
      {logs.updatedAt && <p className="hint">Last refreshed: {new Date(logs.updatedAt).toLocaleTimeString()}</p>}
      {logs.data ? <AuditFeed logs={logs.data.logs} /> : <p>{logs.error ? 'Event stream unavailable.' : 'Loading events…'}</p>}
    </section>
    {target && <Dialog title="Terminate this session?" onClose={() => setTarget(undefined)} busy={!!busy}><p>Terminate {target.username}’s {target.isKiosk ? 'kiosk' : 'device'} session immediately. Terminating your own session signs you out.</p>
      {error && <p role="alert" className="error">{error}</p>}
      <button disabled={!!busy} onClick={() => void action('terminate', async () => { await terminateSession(target.sessionId); setTarget(undefined); sessions.refresh(); logs.refresh(); setMessage('Server confirmed session termination.'); })}>Confirm termination</button>
    </Dialog>}
  </section>;
}
