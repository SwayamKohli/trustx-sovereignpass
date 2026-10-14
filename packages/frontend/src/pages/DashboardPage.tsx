// Citizen Account & Device Management Dashboard View
// Owner: Ananya (Role 2 — Product, UI/UX & Admin SOC Lead)
import { useState } from 'react';
import { friendlyError, logout, mockMode, type User } from '../services/api';
export function DashboardPage({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function signOut() {
    setBusy(true); setError('');
    try { await logout(); onLogout(); } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }
  return <section><p className="eyebrow">{mockMode ? 'Preview account' : 'Signed in'}</p><h1>Hello, {user.username}</h1>
    <p>{mockMode ? 'This is an in-memory UI preview, not an authenticated server session.' : 'Your passkey was verified by the server.'}</p>
    <p>Account role: {user.role === 'ADMIN' ? 'Administrator' : 'Citizen'}</p>
    <div className="future"><h2>Next during the hackathon</h2><p>Device management, two-phase recovery, kiosk access, and the admin security dashboard.</p></div>
    {error && <p role="alert" className="error">{error}</p>}
    <button onClick={signOut} disabled={busy}>{busy ? 'Signing out…' : 'Sign out'}</button>
  </section>;
}
