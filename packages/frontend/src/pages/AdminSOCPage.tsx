import { useState } from 'react';
import { Activity, FileCheck2, Play, RefreshCw, ShieldCheck } from 'lucide-react';
import { adminCredentials, adminLogs, adminSessions, attackReport, friendlyError, mockMode, runAttacks, terminateSession, verifyChain } from '../services/api';
import type { ActiveSession, AttackReport, ChainReport, User } from '../services/types';
import { expiryMilliseconds } from '../services/types';
import { usePolling } from '../services/usePolling';
import { AuditFeed } from '../components/AuditFeed';
import { Dialog } from '../components/Dialog';
export function AdminSOCPage({ user }: { user: User }) { return user.role === 'ADMIN' ? <SOC /> : <section><h1>Administrator access required</h1><p>Use an administrator account; no guest or local-address bypass is enabled.</p></section>; }
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
  const [tab, setTab] = useState<'overview' | 'sessions' | 'credentials' | 'events'>('overview');
  const [filter, setFilter] = useState('');
  const [eventPage, setEventPage] = useState(0);
  const latest = manualReport && (!report.data || Date.parse(manualReport.timestamp) >= Date.parse(report.data.timestamp)) ? manualReport : report.data;
  const filtered = (logs.data?.logs ?? []).filter(log => `${log.eventType} ${log.userId ?? ''}`.toLowerCase().includes(filter.toLowerCase()));
  const lastPage = Math.max(0, Math.ceil(filtered.length / 10) - 1);
  const currentPage = Math.min(eventPage, lastPage);
  const visibleEvents = filtered.slice(currentPage * 10, currentPage * 10 + 10);
  async function action(name: string, operation: () => Promise<void>) {
    if (busy) return; setBusy(name); setError(''); setMessage('');
    try { await operation(); } catch (err) { setError(friendlyError(err)); } finally { setBusy(''); }
  }
  return <section className="soc-dashboard">
    <div className="section-heading"><div><p className="eyebrow"><Activity aria-hidden="true" />Security operations</p><h1>Sessions, incidents & evidence</h1></div><span className="badge">{mockMode ? 'PREVIEW DATA' : 'LIVE BACKEND'}</span></div>
    <div className="soc-toolbar">
      <button disabled={!!busy} onClick={() => void action('probes', async () => { setManualReport(await runAttacks()); logs.refresh(); setMessage(mockMode ? 'Preview report loaded. All probes skipped; no tests ran.' : 'Live HTTP route probes completed; results below are measured, not preset.'); })}><Play aria-hidden="true" />{busy === 'probes' ? 'Running route checks…' : 'Execute live attack runner'}</button>
      <button className="secondary" disabled={!!busy} onClick={() => void action('chain', async () => { setChain(undefined); setChain(await verifyChain()); })}><FileCheck2 aria-hidden="true" />{busy === 'chain' ? 'Verifying…' : 'Verify chain on server'}</button>
      <button className="secondary" onClick={() => { credentials.refresh(); sessions.refresh(); logs.refresh(); report.refresh(); }}><RefreshCw aria-hidden="true" />Refresh data</button>
    </div>
    <p className="hint">Sessions and events refresh every 5 seconds. Probe reports refresh every 10 seconds. A failed refresh leaves older data marked stale.</p>
    {mockMode && <p className="banner">Preview accounts and events only. No live security probes are executed.</p>}
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status">{message}</p>}
    <div className="stats"><div><span>Credentials</span><strong>{credentials.data?.credentials.length ?? '—'}</strong></div><div><span>Active sessions</span><strong>{sessions.data?.sessions.length ?? '—'}</strong></div><div><span>Recent events loaded</span><strong>{logs.data?.logs.length ?? '—'}</strong></div></div>
    <nav aria-label="SOC sections">{(['overview', 'sessions', 'credentials', 'events'] as const).map(value => <button key={value} aria-current={tab === value ? 'page' : undefined} onClick={() => setTab(value)}>{value === 'overview' ? 'Overview' : value === 'events' ? 'Audit events' : value === 'sessions' ? 'Active sessions' : 'Credentials'}</button>)}</nav>
    {tab === 'overview' && <div className="soc-overview">
      <section className="panel-container"><h2><ShieldCheck aria-hidden="true" />Attack probe evidence</h2>
        {report.error && <p role="alert" className="error">{report.error} Earlier evidence may be stale.</p>}
        {!latest ? <p>No probe run yet. Execute the runner to measure the eight route checks.</p> : <>
          <p className="report-counts">Reported: {latest.probes.length} · PASS: {latest.probes.filter(probe => probe.status === 'PASS').length} · FAIL: {latest.probes.filter(probe => probe.status === 'FAIL').length} · SKIPPED: {latest.probes.filter(probe => probe.status === 'SKIPPED').length}</p>
          <p className="hint">Run {latest.runId} · {latest.timestamp}</p><p className="hint">Scope: software-authenticator fixtures against the production HTTP routers. Physical hardware and the browser-origin test are demonstrated separately.</p>
          {latest.probes.length !== 8 && <p className="error">This report does not contain all eight expected probes.</p>}
          <ul className="probe-list compact-probes">{latest.probes.map(probe => <li key={probe.id}><span className={`badge ${probe.status.toLowerCase()}`}>{probe.status}</span><strong>{probe.name}</strong><details><summary>Measured result</summary><p>{probe.detail}</p></details></li>)}</ul>
        </>}
      </section>
      <div><section className="panel-container"><h2>Audit chain</h2>{chain ? <p role="status">{chain.intact ? 'Server verification: INTACT' : 'Server verification: BROKEN'} · {chain.checkedEvents} events · {chain.verifiedAt}</p> : <p>Unverified. No integrity claim is made until the server returns a verification result.</p>}<p className="hint">Checks stored hash anchors, not a freshly invented chain. Full database compromise remains outside this guarantee.</p></section>
        <section className="panel-container recent-events"><h2>Latest security events</h2>{logs.error && <p role="alert" className="error">{logs.error} Events may be stale.</p>}<div className="bounded-feed">{logs.data ? <AuditFeed logs={logs.data.logs.slice(0, 5)} /> : <p>Waiting for event data…</p>}</div></section>
      </div>
    </div>}
    {tab === 'credentials' && <section><h2>Credential inventory</h2>{credentials.error && <p role="alert" className="error">{credentials.error} Data may be stale.</p>}
      {!credentials.data ? <p>Credential data unavailable.</p> : <div className="table-scroll soc-table"><table><caption>Registered passkeys across accounts</caption><thead><tr><th scope="col">Account</th><th scope="col">Device</th><th scope="col">Credential</th><th scope="col">Status</th></tr></thead><tbody>{credentials.data.credentials.map(item => <tr key={item.id}><td>{item.username}</td><td>{item.deviceName}</td><td className="identifier">{item.id}</td><td><span className={`badge ${item.status.toLowerCase()}`}>{item.status}</span></td></tr>)}</tbody></table>{credentials.data.credentials.length === 0 && <p>No enrolled credentials.</p>}</div>}
    </section>}
    {tab === 'sessions' && <section><h2>Active sessions</h2>{sessions.error && <p role="alert" className="error">{sessions.error} Data may be stale.</p>}
      {!sessions.data ? <p>Session data unavailable.</p> : <div className="table-scroll soc-table"><table><caption>Server sessions</caption><thead><tr><th scope="col">Account</th><th scope="col">Context</th><th scope="col">Expires</th><th scope="col">Action</th></tr></thead><tbody>{sessions.data.sessions.map(item => <tr key={item.sessionId}><td>{item.username}<small className="identifier">{item.sessionId.slice(0, 16)}…</small></td><td>{item.isKiosk ? 'Public kiosk' : 'Personal device'}<small>{item.ipAddress}</small><details><summary>Browser details</summary><small>{item.userAgent}</small></details></td><td>{new Date(expiryMilliseconds(item.expiresAt)).toLocaleString()}</td><td><button className="secondary" disabled={!!busy} onClick={() => { setError(''); setTarget(item); }} aria-label={item.isCurrent ? 'Terminate current session' : `Terminate session for ${item.username}`}>Terminate</button></td></tr>)}</tbody></table>{sessions.data.sessions.length === 0 && <p>No active sessions.</p>}</div>}
    </section>}
    {tab === 'events' && <section><div className="section-heading"><h2>Security event stream</h2><label className="event-filter">Filter by event or account<input value={filter} onChange={event => { setFilter(event.target.value); setEventPage(0); }} /></label></div>
      {logs.error && <p role="alert" className="error">{logs.error} Previously loaded events may be stale.</p>}
      <div className="bounded-feed">{logs.data ? <AuditFeed logs={visibleEvents} /> : <p>Waiting for audit data…</p>}</div>
      <div className="pagination"><button className="secondary" disabled={currentPage === 0} onClick={() => setEventPage(currentPage - 1)}>Previous events</button><span>Page {currentPage + 1} of {lastPage + 1} · {filtered.length} recent matching events</span><button className="secondary" disabled={currentPage === lastPage} onClick={() => setEventPage(currentPage + 1)}>Next events</button></div>
    </section>}
    {target && <Dialog title="Terminate this session?" onClose={() => setTarget(undefined)} busy={!!busy}><p>Terminate {target.username}’s {target.isKiosk ? 'kiosk' : 'device'} session immediately. Terminating your own session signs you out.</p>{error && <p role="alert" className="error">{error}</p>}<button disabled={!!busy} onClick={() => void action('terminate', async () => { await terminateSession(target.sessionId); if (target.isCurrent) window.dispatchEvent(new Event('trustx-session-ended')); setTarget(undefined); sessions.refresh(); logs.refresh(); setMessage('Server confirmed session termination.'); })}>Confirm termination</button></Dialog>}
  </section>;
}
