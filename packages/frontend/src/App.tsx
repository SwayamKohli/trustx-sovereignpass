// Frontend Root Application & Routing Entry Point
// Owner: Ananya (Role 2 — Product, UI/UX & Admin SOC Lead) & Swayam (Role 4 — Systems Integration)
import { useCallback, useEffect, useRef, useState } from 'react';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { RecoveryModal } from './components/RecoveryModal';
import { ApiError, currentSession, mockMode } from './services/api';
import { clearDeviceKey } from './services/dpop';
import { expiryMilliseconds, type Session, type User } from './services/types';
import { RecoveryPage } from './pages/RecoveryPage';
import { AdminSOCPage } from './pages/AdminSOCPage';
import { KioskAuthPage } from './pages/KioskAuthPage';
import { KioskQRModal } from './components/KioskQRModal';
import { AgentShieldPage } from './pages/AgentShieldPage';
import { CryptoLabPage } from './pages/CryptoLabPage';

const GUEST_JUDGE_USER: User = { id: 'usr_guest_judge', username: 'guest_judge', role: 'ADMIN' };

export default function App() {
  const [page, setPage] = useState<'login' | 'register' | 'recovery' | 'account' | 'admin' | 'phone' | 'agent' | 'crypto'>(
    window.location.pathname === '/kiosk-auth' ? 'phone' : 'login'
  );
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(page !== 'phone');
  const [notice, setNotice] = useState('');
  const [kiosk, setKiosk] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);
  const main = useRef<HTMLElement>(null);

  const onAuthorized = useCallback((value: Session) => {
    setSession(value);
    setKiosk(false);
    setPage('account');
    setNotice('');
  }, []);

  useEffect(() => {
    if (codes.length === 0 && !kiosk) main.current?.focus();
  }, [page, session, codes, kiosk]);

  useEffect(() => {
    function ended() {
      setSession(null);
      setKiosk(false);
      setPage('login');
      setNotice('Your session ended or could not be verified. Sign in again.');
      if (session?.isKiosk && !mockMode) {
        void clearDeviceKey().catch(() => setNotice('Session ended. Browser key cleanup failed; clear site data before leaving this terminal.'));
      }
    }
    window.addEventListener('trustx-session-ended', ended);
    return () => window.removeEventListener('trustx-session-ended', ended);
  }, [session?.isKiosk]);

  useEffect(() => {
    if (page === 'phone') return;
    let active = true;
    void currentSession().then(value => {
      if (active) onAuthorized(value);
    }).catch(error => {
      if (active && !(error instanceof ApiError && error.status === 401)) {
        setNotice('Session restoration is unavailable. Sign in to continue.');
      }
    }).finally(() => {
      if (active) setRestoring(false);
    });
    return () => { active = false; };
  }, [onAuthorized]);

  useEffect(() => {
    if (!session?.isKiosk || !session.expiresAt) return;
    const timer = setTimeout(() => {
      setSession(null);
      setPage('login');
      setNotice('This terminal’s session time has expired. Sign in again.');
      if (!mockMode) {
        void clearDeviceKey().catch(() => setNotice('Terminal time expired. Browser key cleanup failed; clear site data before leaving this shared terminal.'));
      }
    }, Math.max(0, expiryMilliseconds(session.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [session]);

  function navigate(next: typeof page) {
    setPage(next);
    setNotice('');
    if (window.location.pathname !== '/' && window.location.pathname !== '/kiosk-auth') {
      window.history.replaceState(null, '', '/');
    }
  }

  const currentUser = session?.user || GUEST_JUDGE_USER;

  return (
    <>
      <a className="skip" href="#content">Skip to content</a>
      <header>
        <div className="flex items-center gap-3">
          <a href="#content" className="brand" onClick={() => navigate(session ? 'account' : 'login')}>
            TrustX <span>SovereignPass</span>
          </a>
          <span className="badge-live-pulse hidden sm:inline-flex">● BANK-GRADE SECURITY</span>
        </div>
        <div className="flex items-center gap-2">
          {session && (
            <span className="eyebrow hidden md:inline">
              {session.user.role === 'ADMIN' ? 'Admin SOC Active' : 'Citizen Access'}
            </span>
          )}
          <nav aria-label="Header quick navigation" className="m-0 flex gap-1.5">
            <button
              aria-current={page === 'agent' ? 'page' : undefined}
              className="text-xs px-2.5 py-1.5"
              onClick={() => navigate('agent')}
            >
              🤖 AgentShield
            </button>
            <button
              aria-current={page === 'crypto' ? 'page' : undefined}
              className="text-xs px-2.5 py-1.5"
              onClick={() => navigate('crypto')}
            >
              ⚛️ Crypto Lab
            </button>
            <a
              href="https://b4nk-secure.local:3001"
              target="_blank"
              rel="noreferrer"
              className="secondary inline-flex items-center px-2.5 py-1.5 rounded-lg border border-red-900/60 text-red-400 no-underline text-xs hover:bg-red-950/40"
            >
              ⚠️ Phishing Lab
            </a>
          </nav>
        </div>
      </header>

      {mockMode && (
        <div className="banner" role="status">
          UI PREVIEW · No real passkeys, sessions, or security results. Accounts reset on refresh.
        </div>
      )}

      <main id="content" ref={main} tabIndex={-1} className={session || page === 'agent' || page === 'crypto' ? 'workspace' : 'grid gap-8 md:grid-cols-2'}>
        {!session && page !== 'agent' && page !== 'crypto' && page !== 'phone' && (
          <aside>
            <p className="eyebrow">Access you can trust</p>
            <h2>Your identity.<br />Your device.<br />Your control.</h2>
            <p>Sign in with a passkey instead of a password. Your biometric data stays on your device.</p>
            <p className="hint">CyberCup 6.0 · Problem CC6-IC04 · Evaluation 2</p>
          </aside>
        )}

        <div className="card">
          {notice && <p role="status" className="banner">{notice}</p>}
          
          {restoring ? (
            <p role="status">Checking your session…</p>
          ) : session ? (
            <>
              <nav aria-label="Signed-in views">
                <button aria-current={page === 'account' ? 'page' : undefined} onClick={() => navigate('account')}>
                  My account
                </button>
                <button aria-current={page === 'admin' ? 'page' : undefined} onClick={() => navigate('admin')}>
                  Admin SOC
                </button>
                <button aria-current={page === 'agent' ? 'page' : undefined} onClick={() => navigate('agent')}>
                  🤖 AgentShield (AI Security)
                </button>
                <button aria-current={page === 'crypto' ? 'page' : undefined} onClick={() => navigate('crypto')}>
                  ⚛️ Crypto Lab (PQC & USB)
                </button>
              </nav>

              {page === 'admin' ? (
                <AdminSOCPage user={session.user} />
              ) : page === 'agent' ? (
                <AgentShieldPage user={session.user} />
              ) : page === 'crypto' ? (
                <CryptoLabPage user={session.user} />
              ) : (
                <DashboardPage session={session} onLogout={() => { setSession(null); navigate('login'); }} />
              )}
            </>
          ) : page === 'phone' ? (
            <KioskAuthPage />
          ) : page === 'agent' ? (
            <div>
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
                <span className="text-xs text-slate-400">Viewing Live AgentShield Security Lab (Judge Demo Mode)</span>
                <button className="secondary text-xs" onClick={() => navigate('login')}>Back to Citizen Login</button>
              </div>
              <AgentShieldPage user={currentUser} />
            </div>
          ) : page === 'crypto' ? (
            <div>
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
                <span className="text-xs text-slate-400">Viewing Live NIST PQC & FIDO2 Lab (Judge Demo Mode)</span>
                <button className="secondary text-xs" onClick={() => navigate('login')}>Back to Citizen Login</button>
              </div>
              <CryptoLabPage user={currentUser} />
            </div>
          ) : (
            <>
              <nav aria-label="Account access">
                <button aria-current={page === 'login' ? 'page' : undefined} onClick={() => navigate('login')}>
                  Sign in
                </button>
                <button aria-current={page === 'register' ? 'page' : undefined} onClick={() => navigate('register')}>
                  Create account
                </button>
                <button aria-current={page === 'recovery' ? 'page' : undefined} onClick={() => navigate('recovery')}>
                  Recover account
                </button>
              </nav>

              {page === 'register' ? (
                <RegisterPage onRegistered={setCodes} />
              ) : page === 'recovery' ? (
                <RecoveryPage onSignIn={() => navigate('login')} />
              ) : (
                <LoginPage onLogin={user => onAuthorized({ user })} />
              )}

              <button className="secondary kiosk-launch" onClick={() => setKiosk(true)}>
                Use a shared terminal
              </button>

              {mockMode && (
                <p className="hint">
                  Preview sign-in: <code>demo</code> (citizen) or <code>demo-admin</code> (SOC). Preview recovery code: <code>DEMO-ONLY-0001</code>.
                </p>
              )}
            </>
          )}
        </div>
      </main>

      {codes.length > 0 && <RecoveryModal codes={codes} onSaved={() => { setCodes([]); setPage('login'); }} />}
      {kiosk && <KioskQRModal onClose={() => setKiosk(false)} onAuthorized={onAuthorized} />}
      <footer>TrustX SovereignPass · CyberCup 6.0 | Problem CC6-IC04 · Evaluation 2</footer>
    </>
  );
}
