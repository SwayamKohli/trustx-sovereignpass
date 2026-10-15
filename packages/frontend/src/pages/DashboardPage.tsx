// Citizen Account & Device Management Dashboard View
// Owner: Ananya (Role 2 — Product, UI/UX & Admin SOC Lead)
import { useState } from 'react';
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
  return <section><p className="eyebrow">{mockMode ? 'Preview account' : 'Signed in'}</p><h1>Hello, {user.username}</h1>
    <p>{mockMode ? 'This is an in-memory UI preview, not an authenticated server session.' : 'Your passkey was verified by the server.'}</p>
    <p>Account role: {user.role === 'ADMIN' ? 'Administrator' : 'Citizen'}</p>
    {session.isKiosk ? <p className="banner" role="status">Public terminal · {session.expiresAt ? `${Math.max(0, Math.ceil((expiryMilliseconds(session.expiresAt) - now) / 60_000))} minutes remaining` : 'Expiry unavailable'}. Sign out when finished.</p> : !mockMode && <p className="hint">{session.isDeviceBound ? 'This session is bound to your browser’s device key.' : 'This session has no confirmed device-key binding. Sign out and sign in from the live bank before demonstrating replay protection.'}</p>}
    <div className="section-heading"><h2>Your devices</h2><div className="actions"><button className="secondary" onClick={devices.refresh}>Refresh devices</button>{!session.isKiosk && <button onClick={() => setAdding(true)}>Add a passkey</button>}</div></div>
    {devices.error && <p className="error" role="alert">{devices.error} Previously loaded devices may be stale.</p>}
    {devices.data ? <DeviceTable devices={devices.data.devices} onChanged={devices.refresh} /> : <p>{devices.error ? 'Device inventory is unavailable.' : 'Loading your devices…'}</p>}
    {error && <p role="alert" className="error">{error}</p>}
    <button onClick={signOut} disabled={busy}>{busy ? 'Signing out…' : 'Sign out'}</button>
    {adding && <PasskeyModal onClose={() => setAdding(false)} onAdded={devices.refresh} />}
  </section>;
}
