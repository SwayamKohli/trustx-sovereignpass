import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, FlaskConical, LayoutDashboard, LogIn, PanelsTopLeft, ShieldCheck, Languages } from 'lucide-react';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { RecoveryPage } from './pages/RecoveryPage';
import { AdminSOCPage } from './pages/AdminSOCPage';
import { KioskAuthPage } from './pages/KioskAuthPage';
import { AgentShieldPage } from './pages/AgentShieldPage';
import { CryptoLabPage } from './pages/CryptoLabPage';
import { DemoArenaPage } from './pages/DemoArenaPage';
import { PhishingLabPage } from './pages/PhishingLabPage';
import { RecoveryModal } from './components/RecoveryModal';
import { KioskQRModal } from './components/KioskQRModal';
import { PersonaGuide } from './components/PersonaGuide';
import { AccessHelpPage } from './pages/AccessHelpPage';
import { ApiError, currentSession, mockMode } from './services/api';
import { clearDeviceKey } from './services/dpop';
import { expiryMilliseconds, type Session } from './services/types';
import { getLanguage, setLanguage, t, tr, type Language } from './services/i18n';

const routes = { login: '/', register: '/register', recovery: '/recovery', account: '/account', admin: '/admin', phone: '/kiosk-auth', agent: '/agent', crypto: '/crypto', demo: '/demo', phishing: '/phishing', access: '/access' } as const;
type Page = keyof typeof routes;
function locationPage(): Page { return (Object.entries(routes).find(([, path]) => path === window.location.pathname)?.[0] as Page) ?? 'login'; }

export default function App() {
  const [page, setPage] = useState<Page>(locationPage);
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(!['phone', 'phishing'].includes(page));
  const [notice, setNotice] = useState('');
  const [kiosk, setKiosk] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);
  const [lang, setLang] = useState<Language>(getLanguage());
  const [securityKey, setSecurityKey] = useState(false);
  const main = useRef<HTMLElement>(null);
  const labMenu = useRef<HTMLDetailsElement>(null);
  const strings = t();
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  function navigate(next: Page) { if (labMenu.current) labMenu.current.open = false; setPage(next); setNotice(''); window.history.pushState(null, '', routes[next]); }
  const onAuthorized = useCallback((value: Session) => {
    setSession(value); setKiosk(false); setPage('account'); setNotice('');
    window.history.replaceState(null, '', routes.account);
  }, []);

  useEffect(() => {
    function onLangChange() { setLang(getLanguage()); }
    window.addEventListener('trustx-lang-changed', onLangChange);
    return () => window.removeEventListener('trustx-lang-changed', onLangChange);
  }, []);

  useEffect(() => { function pop() { setPage(locationPage()); } window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop); }, []);
  useEffect(() => { if (!codes.length && !kiosk) main.current?.focus(); }, [page, session, codes, kiosk]);
  useEffect(() => {
    function ended() {
      if (!session) return;
      setSession(null); setKiosk(false); setPage('login'); window.history.replaceState(null, '', '/');
      setNotice('Your session ended or could not be verified. Sign in again.');
      if (session.isKiosk && !mockMode) void clearDeviceKey().catch(() => setNotice('Session ended. Clear site data before leaving this terminal.'));
    }
    window.addEventListener('trustx-session-ended', ended);
    return () => window.removeEventListener('trustx-session-ended', ended);
  }, [session]);
  useEffect(() => {
    if (['phone', 'phishing'].includes(locationPage())) return;
    let active = true;
    void currentSession().then(value => {
      if (active) { setSession(value); if (locationPage() === 'login') { setPage('account'); window.history.replaceState(null, '', '/account'); } }
    }).catch(error => {
      if (active && !(error instanceof ApiError && error.status === 401)) setNotice('The bank connection is unavailable. Start all services with npm run dev and open the bank URL.');
    }).finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!session?.isKiosk || !session.expiresAt) return;
    const timer = setTimeout(() => {
      setSession(null); setPage('login'); setNotice('This terminal session expired. Sign in again.');
      if (!mockMode) void clearDeviceKey().catch(() => setNotice('Terminal time expired. Clear this browser’s site data before leaving.'));
    }, Math.max(0, expiryMilliseconds(session.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [session]);

  const publicLab = ['demo', 'crypto', 'phishing', 'access'].includes(page);
  const wide = !!session || publicLab;
  return <>
    <a className="skip" href="#content">{tr('Skip to content', 'मुख्य जानकारी पर जाएँ')}</a>
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {page === 'phishing' ? <span className="brand"><ShieldCheck aria-hidden="true" />TrustX <span>Controlled attacker lab</span></span> : <button className="brand brand-button" onClick={() => navigate(session ? 'account' : 'login')}>
          <ShieldCheck aria-hidden="true" />TrustX <span>{strings.brandSubtitle}</span>
        </button>}

        {/* English / हिन्दी Linguistic Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', background: '#edf3f0', border: '1px solid #ccd8d4', borderRadius: '8px', padding: '2px' }}>
          <button
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 700,
              background: lang === 'en' ? '#164d45' : 'transparent',
              color: lang === 'en' ? '#fff' : '#4b625d',
              border: 'none',
              borderRadius: '6px',
              boxShadow: 'none',
              cursor: 'pointer',
            }}
            onClick={() => setLanguage('en')}
            aria-label="Switch to English"
          >
            EN
          </button>
          <button
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 700,
              background: lang === 'hi' ? '#164d45' : 'transparent',
              color: lang === 'hi' ? '#fff' : '#4b625d',
              border: 'none',
              borderRadius: '6px',
              boxShadow: 'none',
              cursor: 'pointer',
            }}
            onClick={() => setLanguage('hi')}
            aria-label="Switch to Hindi"
          >
            हिन्दी
          </button>
        </div>
      </div>

      {page !== 'phishing' && <nav aria-label="Header quick navigation">
        <button aria-current={page === 'access' ? 'page' : undefined} onClick={() => navigate('access')}>{tr('Access help', 'प्रवेश में सहायता')}</button>
        {session ? <button onClick={() => navigate('account')}><LayoutDashboard aria-hidden="true" />{strings.navAccount}</button> : <button onClick={() => navigate('login')}><LogIn aria-hidden="true" />{strings.navSignIn}</button>}
        <details ref={labMenu} className="lab-menu"><summary>{tr('Security labs', 'सुरक्षा प्रयोगशालाएँ')}</summary><div>
        <button aria-current={page === 'demo' ? 'page' : undefined} onClick={() => navigate('demo')}><PanelsTopLeft aria-hidden="true" />{strings.navDemo}</button>
        <button aria-current={page === 'agent' ? 'page' : undefined} onClick={() => navigate('agent')}><Bot aria-hidden="true" />{strings.navAgent}</button>
        <button aria-current={page === 'crypto' ? 'page' : undefined} onClick={() => navigate('crypto')}><FlaskConical aria-hidden="true" />{strings.navCrypto}</button>
        </div></details>
      </nav>}
    </header>
    {mockMode && <div className="banner" role="status">UI PREVIEW · No real passkeys, sessions, or security results. Accounts reset on refresh.</div>}
    
    <main id="content" ref={main} tabIndex={-1} style={{ maxWidth: '1320px', margin: '20px auto', padding: '0 24px' }}>
      {/* 4 Targeted Citizen Personas Guide */}
      {page === 'demo' && <details className="persona-guide"><summary>{tr('Who is TrustX for? Explore four example journeys', 'TrustX किसके लिए है? चार उदाहरण देखें')}</summary><PersonaGuide onSelectAction={targetPage => targetPage === 'phone' ? setKiosk(true) : navigate(targetPage)} /></details>}

      <div className={wide ? 'workspace' : 'auth-layout'}>
        {!wide && page !== 'phone' && (
          <aside>
            <p className="eyebrow">{strings.accessEyebrow}</p>
            <h2>{strings.heroTitle1}<br />{strings.heroTitle2}<br />{strings.heroTitle3}</h2>
            <p>{strings.heroDescription}</p>
            <p className="hint">Connected origin: {window.location.origin}</p>
          </aside>
        )}
        <div className="card">
          {notice && <p className="banner" role="status">{notice}</p>}
          {restoring ? <p role="status">Checking your session…</p>
            : page === 'phishing' ? <PhishingLabPage />
            : page === 'phone' ? <KioskAuthPage />
            : page === 'access' ? <AccessHelpPage onChoose={(target, key = false) => { setSecurityKey(key); if (target === 'kiosk') setKiosk(true); else navigate(target); }} />
            : page === 'demo' ? <DemoArenaPage session={session} onSignIn={() => navigate('login')} />
            : page === 'crypto' ? <CryptoLabPage user={session?.user} />
            : page === 'agent' ? session ? <AgentShieldPage user={session.user} /> : <section><h1>Sign in to authorize an agent</h1><p>Agent capabilities require a real session and passkey approval.</p><button onClick={() => navigate('login')}>Go to sign in</button></section>
            : session ? <>
              {session.user.role === 'ADMIN' && <nav aria-label="Signed-in views"><button aria-current={page !== 'admin' ? 'page' : undefined} onClick={() => navigate('account')}>{strings.navAccount}</button><button aria-current={page === 'admin' ? 'page' : undefined} onClick={() => navigate('admin')}>{strings.navAdminSOC}</button></nav>}
              {page === 'admin' ? <AdminSOCPage user={session.user} /> : <DashboardPage session={session} onLogout={() => { setSession(null); navigate('login'); }} />}
            </> : <>
              <nav aria-label="Account access"><button aria-current={page === 'login' ? 'page' : undefined} onClick={() => navigate('login')}>{strings.navSignIn}</button><button aria-current={page === 'register' ? 'page' : undefined} onClick={() => navigate('register')}>{strings.navCreateAccount}</button><button aria-current={page === 'recovery' ? 'page' : undefined} onClick={() => navigate('recovery')}>{strings.navRecover}</button></nav>
              {page === 'register' ? <RegisterPage onRegistered={setCodes} securityKey={securityKey} /> : page === 'recovery' ? <RecoveryPage onSignIn={() => navigate('login')} /> : <LoginPage onLogin={onAuthorized} securityKey={securityKey} />}
              <button className="secondary kiosk-launch" onClick={() => setKiosk(true)}>{strings.navSharedTerminal}</button>
              {mockMode && <p className="hint">Preview sign-in: <code>demo</code> or <code>demo-admin</code>. Preview recovery code: <code>DEMO-ONLY-0001</code>.</p>}
            </>}
        </div>
      </div>
    </main>
    {!!codes.length && <RecoveryModal codes={codes} onSaved={() => { setCodes([]); navigate('login'); }} />}
    {kiosk && <KioskQRModal onClose={() => setKiosk(false)} onAuthorized={onAuthorized} />}
    <footer>TrustX SovereignPass · CyberCup 6.0 · Results shown only after verification</footer>
  </>;
}
