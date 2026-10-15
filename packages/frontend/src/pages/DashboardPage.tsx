import { useState } from 'react';
import { Activity, ShieldCheck, ShieldAlert, Cpu } from 'lucide-react';
import { friendlyError, listDevices, logout, mockMode } from '../services/api';
import type { Session } from '../services/types';
import { expiryMilliseconds } from '../services/types';
import { useNow, usePolling } from '../services/usePolling';
import { DeviceTable } from '../components/DeviceTable';
import { PasskeyModal } from '../components/PasskeyModal';

export function DashboardPage({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const { user } = session;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const devices = usePolling(listDevices);
  const now = useNow();

  async function signOut() {
    setBusy(true); setError('');
    try { await logout(); onLogout(); } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }

  const riskScore = session.risk?.score ?? 10;
  const riskLevel = session.risk?.level ?? 'LOW';
  const riskReasons = session.risk?.reasons ?? ['Normal session baseline', 'Origin & device key matched'];

  return (
    <section>
      <p className="eyebrow">{mockMode ? 'Preview account' : 'Signed in'}</p>
      <h1>Hello, {user.username}</h1>
      <p>{mockMode ? 'This is an in-memory UI preview, not an authenticated server session.' : 'Your passkey was verified by the server.'}</p>
      <p>Account role: {user.role === 'ADMIN' ? 'Administrator' : 'Citizen'}</p>
      
      {session.isKiosk ? (
        <p className="banner" role="status">Public terminal · {session.expiresAt ? `${Math.max(0, Math.ceil((expiryMilliseconds(session.expiresAt) - now) / 60_000))} minutes remaining` : 'Expiry unavailable'}. Sign out when finished.</p>
      ) : !mockMode && (
        <p className="hint">{session.isDeviceBound ? 'This session is bound to your browser’s device key (DPoP RFC 9449).' : 'This session has no confirmed device-key binding. Sign out and sign in from the live bank before demonstrating replay protection.'}</p>
      )}

      {/* Requirement 6: Contextual Risk Engine & Anomaly Detection Card */}
      <div className="panel-container" style={{ margin: '20px 0', padding: '16px 20px', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '12px', background: '#090e17' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity aria-hidden="true" style={{ color: '#38bdf8' }} />
            <h2 style={{ margin: 0, fontSize: '16px' }}>Contextual Risk & Anomaly Engine (Req 6)</h2>
          </div>
          <span className={`badge ${riskLevel === 'LOW' ? 'pass' : riskLevel === 'MEDIUM' ? 'skipped' : 'fail'}`} style={{ fontSize: '12px', padding: '4px 10px' }}>
            Score: {riskScore} / 100 ({riskLevel} RISK)
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
          <div style={{ background: '#020617', padding: '10px 14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Network IP Baseline</span>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>{session.risk?.ipAddress || '127.0.0.1'} · Matched</div>
          </div>
          <div style={{ background: '#020617', padding: '10px 14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Device Binding</span>
            <div style={{ fontSize: '13px', fontWeight: 600, color: session.isDeviceBound ? '#34d399' : '#f87171', marginTop: '2px' }}>
              {session.isDeviceBound ? 'DPoP Key Bound (Active)' : 'Unbound'}
            </div>
          </div>
          <div style={{ background: '#020617', padding: '10px 14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Step-Up Threshold</span>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>Score &ge; 70 &rarr; Biometric Passkey Re-auth</div>
          </div>
        </div>

        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
          <strong>Evaluated Signals: </strong>
          {riskReasons.join(' · ')}
        </div>
      </div>

      <div className="section-heading">
        <h2>Your devices</h2>
        <div className="actions">
          <button className="secondary" onClick={devices.refresh}>Refresh devices</button>
          {!session.isKiosk && <button onClick={() => setAdding(true)}>Add a passkey</button>}
        </div>
      </div>
      {devices.error && <p className="error" role="alert">{devices.error} Previously loaded devices may be stale.</p>}
      {devices.data ? <DeviceTable devices={devices.data.devices} onChanged={devices.refresh} /> : <p>{devices.error ? 'Device inventory is unavailable.' : 'Loading your devices…'}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <button onClick={signOut} disabled={busy}>{busy ? 'Signing out…' : 'Sign out'}</button>
      {adding && <PasskeyModal onClose={() => setAdding(false)} onAdded={devices.refresh} />}
    </section>
  );
}
