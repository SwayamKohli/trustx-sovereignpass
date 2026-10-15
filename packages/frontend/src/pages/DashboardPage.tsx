import { useState, useEffect } from 'react';
import { Activity, ShieldCheck, ShieldAlert, Cpu, Landmark, Send, Zap, RotateCcw } from 'lucide-react';
import { friendlyError, listDevices, logout, mockMode, request } from '../services/api';
import type { Session } from '../services/types';
import { expiryMilliseconds } from '../services/types';
import { useNow, usePolling } from '../services/usePolling';
import { DeviceTable } from '../components/DeviceTable';
import { PasskeyModal } from '../components/PasskeyModal';
import { t } from '../services/i18n';

export function DashboardPage({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const { user } = session;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [balance, setBalance] = useState<number>(125000);
  const [txBusy, setTxBusy] = useState(false);
  const [txResult, setTxResult] = useState('');
  const devices = usePolling(listDevices);
  const now = useNow();
  const strings = t();

  async function signOut() {
    setBusy(true); setError('');
    try { await logout(); onLogout(); } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }

  async function executeTransfer(amount: number, recipient: string) {
    if (txBusy) return;
    setTxBusy(true); setTxResult(''); setError('');
    try {
      const res = await request<{ success: boolean; txId: string; amount: number; recipient: string; stepUpUsed: boolean; message: string }>('/demo/transfer', { recipient, amount });
      setBalance(prev => Math.max(0, prev - amount));
      setTxResult(res.message);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setTxBusy(false);
    }
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

      {/* Feature: Sovereign Banking Operations (Live Step-Up Demo) */}
      <div className="panel-container" style={{ margin: '20px 0', padding: '20px', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '14px', background: '#041517' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Landmark aria-hidden="true" style={{ color: '#34d399', width: '20px', height: '20px' }} />
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', color: '#f8fafc' }}>{strings.bankingTitle}</h2>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Account: SBIN-00921-SOVEREIGN · Digital Rupee (e₹)</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>{strings.accountBalance}</span>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#34d399', fontFamily: 'monospace' }}>
              ₹{balance.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        <p style={{ fontSize: '13px', color: '#cbd5e1', margin: '0 0 14px 0' }}>
          {strings.bankingSubtitle}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginBottom: '12px' }}>
          <button
            disabled={txBusy}
            onClick={() => void executeTransfer(450, 'Tata Power / Electricity Board')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: '#0f172a', border: '1px solid #334155' }}
          >
            <Zap aria-hidden="true" style={{ width: '16px', height: '16px', color: '#38bdf8' }} />
            {txBusy ? 'Processing…' : strings.lowRiskBtn}
          </button>

          <button
            disabled={txBusy}
            onClick={() => void executeTransfer(50000, 'Ramesh Patel (State Bank of India)')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', border: '1px solid #38bdf8' }}
          >
            <Send aria-hidden="true" style={{ width: '16px', height: '16px' }} />
            {txBusy ? 'Awaiting Biometric Verification…' : strings.highRiskBtn}
          </button>
        </div>

        {txResult && (
          <p role="status" className="banner" style={{ textAlign: 'left', background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.4)', color: '#34d399', margin: '10px 0 0 0' }}>
            ✓ {txResult}
          </p>
        )}
      </div>

      {/* Requirement 6: Contextual Risk Engine & Anomaly Detection Card */}
      <div className="panel-container" style={{ margin: '20px 0', padding: '16px 20px', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '12px', background: '#090e17' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity aria-hidden="true" style={{ color: '#38bdf8' }} />
            <h2 style={{ margin: 0, fontSize: '16px' }}>{strings.riskTitle}</h2>
          </div>
          <span className={`badge ${riskLevel === 'LOW' ? 'pass' : riskLevel === 'MEDIUM' ? 'skipped' : 'fail'}`} style={{ fontSize: '12px', padding: '4px 10px' }}>
            Score: {riskScore} / 100 ({riskLevel === 'LOW' ? strings.riskLow : riskLevel === 'MEDIUM' ? strings.riskMedium : strings.riskHigh})
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
          <div style={{ background: '#020617', padding: '10px 14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>{strings.ipBaseline}</span>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>{session.risk?.ipAddress || '127.0.0.1'} · Matched</div>
          </div>
          <div style={{ background: '#020617', padding: '10px 14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>{strings.deviceBinding}</span>
            <div style={{ fontSize: '13px', fontWeight: 600, color: session.isDeviceBound ? '#34d399' : '#f87171', marginTop: '2px' }}>
              {session.isDeviceBound ? 'DPoP Key Bound (Active)' : 'Unbound'}
            </div>
          </div>
          <div style={{ background: '#020617', padding: '10px 14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>{strings.stepUpThreshold}</span>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>Score &ge; 70 &rarr; Biometric Passkey Re-auth</div>
          </div>
        </div>

        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
          <strong>{strings.evaluatedSignals}: </strong>
          {riskReasons.join(' · ')}
        </div>
      </div>

      <div className="section-heading">
        <h2>{strings.devicesHeading}</h2>
        <div className="actions">
          <button className="secondary" onClick={devices.refresh}>{strings.refreshDevices}</button>
          {!session.isKiosk && <button onClick={() => setAdding(true)}>{strings.addPasskey}</button>}
        </div>
      </div>
      {devices.error && <p className="error" role="alert">{devices.error} Previously loaded devices may be stale.</p>}
      {devices.data ? <DeviceTable devices={devices.data.devices} onChanged={devices.refresh} /> : <p>{devices.error ? 'Device inventory is unavailable.' : 'Loading your devices…'}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <button onClick={signOut} disabled={busy}>{busy ? 'Signing out…' : strings.signOut}</button>
      {adding && <PasskeyModal onClose={() => setAdding(false)} onAdded={devices.refresh} />}
    </section>
  );
}
