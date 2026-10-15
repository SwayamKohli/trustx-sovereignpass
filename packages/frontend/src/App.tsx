// Frontend Root Application & Routing Entry Point
// Owner: Ananya (Role 2 — Product, UI/UX & Admin SOC Lead)
import { useCallback, useEffect, useRef, useState } from 'react';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { RecoveryModal } from './components/RecoveryModal';
import { ApiError, currentSession, mockMode } from './services/api';
import { clearDeviceKey } from './services/dpop';
import { expiryMilliseconds, type Session } from './services/types';
import { RecoveryPage } from './pages/RecoveryPage';
import { AdminSOCPage } from './pages/AdminSOCPage';
import { KioskAuthPage } from './pages/KioskAuthPage';
import { KioskQRModal } from './components/KioskQRModal';
export default function App() {
  const [page, setPage] = useState<'login' | 'register' | 'recovery' | 'account' | 'admin' | 'phone'>(window.location.pathname === '/kiosk-auth' ? 'phone' : 'login');
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(page !== 'phone');
  const [notice, setNotice] = useState('');
  const [kiosk, setKiosk] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);
  const main = useRef<HTMLElement>(null);
  const onAuthorized = useCallback((value: Session) => { setSession(value); setKiosk(false); setPage('account'); setNotice(''); }, []);
  useEffect(() => { if (codes.length === 0 && !kiosk) main.current?.focus(); }, [page, session, codes, kiosk]);
  useEffect(() => {
    function ended() {
      setSession(null); setKiosk(false); setPage('login'); setNotice('Your session ended or could not be verified. Sign in again.');
      if (session?.isKiosk && !mockMode) void clearDeviceKey().catch(() => setNotice('Session ended. Browser key cleanup failed; clear site data before leaving this terminal.'));
    }
    window.addEventListener('trustx-session-ended', ended);
    return () => window.removeEventListener('trustx-session-ended', ended);
  }, [session?.isKiosk]);
  useEffect(() => {
    if (page === 'phone') return;
    let active = true;
    void currentSession().then(value => { if (active) onAuthorized(value); }).catch(error => {
      if (active && !(error instanceof ApiError && error.status === 401)) setNotice('Session restoration is unavailable. Sign in to continue.');
    }).finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, [onAuthorized]);
  useEffect(() => {
    if (!session?.isKiosk || !session.expiresAt) return;
    const timer = setTimeout(() => {
      setSession(null); setPage('login'); setNotice('This terminal’s session time has expired. Sign in again.');
      if (!mockMode) void clearDeviceKey().catch(() => setNotice('Terminal time expired. Browser key cleanup failed; clear site data before leaving this shared terminal.'));
    }, Math.max(0, expiryMilliseconds(session.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [session]);
  function navigate(next: typeof page) { setPage(next); setNotice(''); if (window.location.pathname !== '/') window.history.replaceState(null, '', '/'); }
  return <><a className="skip" href="#content">Skip to content</a>
    <header><a href="#content" className="brand">TrustX <span>SovereignPass</span></a><span className="eyebrow">{session?.user.role === 'ADMIN' ? 'Security operations' : 'Citizen access'}</span></header>
    {mockMode && <div className="banner" role="status">UI PREVIEW · No real passkeys, sessions, or security results. Accounts reset on refresh.</div>}
    <main id="content" ref={main} tabIndex={-1} className={session ? 'workspace' : 'grid gap-8 md:grid-cols-2'}>
      {!session && <aside><p className="eyebrow">Access you can trust</p><h2>Your identity.<br />Your device.<br />Your control.</h2><p>Sign in with a passkey instead of a password. Your biometric data stays on your device.</p><p className="hint">CyberCup 6.0 · TrustX SovereignPass</p></aside>}
      <div className="card">{notice && <p role="status" className="banner">{notice}</p>}
        {restoring ? <p role="status">Checking your session…</p> : session ? <>
          <nav aria-label="Signed-in views"><button aria-current={page === 'account' ? 'page' : undefined} onClick={() => navigate('account')}>My account</button>{session.user.role === 'ADMIN' && <button aria-current={page === 'admin' ? 'page' : undefined} onClick={() => navigate('admin')}>Admin SOC</button>}</nav>
          {page === 'admin' && session.user.role === 'ADMIN' ? <AdminSOCPage user={session.user} /> : <DashboardPage session={session} onLogout={() => { setSession(null); navigate('login'); }} />}
        </> : page === 'phone' ? <KioskAuthPage /> : <>
          <nav aria-label="Account access"><button aria-current={page === 'login' ? 'page' : undefined} onClick={() => navigate('login')}>Sign in</button><button aria-current={page === 'register' ? 'page' : undefined} onClick={() => navigate('register')}>Create account</button><button aria-current={page === 'recovery' ? 'page' : undefined} onClick={() => navigate('recovery')}>Recover account</button></nav>
          {page === 'register' ? <RegisterPage onRegistered={setCodes} /> : page === 'recovery' ? <RecoveryPage onSignIn={() => navigate('login')} /> : <LoginPage onLogin={user => onAuthorized({ user })} />}
          <button className="secondary kiosk-launch" onClick={() => setKiosk(true)}>Use a shared terminal</button>
          {mockMode && <p className="hint">Preview sign-in: <code>demo</code> (citizen) or <code>demo-admin</code> (SOC). Preview recovery code: <code>DEMO-ONLY-0001</code>.</p>}
        </>}
      </div>
    </main>
    {codes.length > 0 && <RecoveryModal codes={codes} onSaved={() => { setCodes([]); setPage('login'); }} />}
    {kiosk && <KioskQRModal onClose={() => setKiosk(false)} onAuthorized={onAuthorized} />}
    <footer>TrustX SovereignPass · Evaluation 2</footer>
  </>;
}
