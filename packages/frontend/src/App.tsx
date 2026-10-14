// Frontend Root Application & Routing Entry Point
// Owner: Ananya (Role 2 — Product, UI/UX & Admin SOC Lead)
import { useEffect, useRef, useState } from 'react';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { RecoveryModal } from './components/RecoveryModal';
import { mockMode, type User } from './services/api';
export default function App() {
  const [page, setPage] = useState<'login' | 'register'>('login');
  const [user, setUser] = useState<User | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const main = useRef<HTMLElement>(null);
  useEffect(() => { main.current?.focus(); }, [page, user, codes]);
  return <><a className="skip" href="#content">Skip to content</a>
    <header><a href="#content" className="brand">TrustX <span>SovereignPass</span></a><span className="eyebrow">Citizen access</span></header>
    {mockMode && <div className="banner" role="status">UI PREVIEW · No real passkeys, sessions, or security results. Accounts reset on refresh.</div>}
    <main id="content" ref={main} tabIndex={-1} className="grid gap-8 md:grid-cols-2">
      <aside><p className="eyebrow">Access you can trust</p><h2>Your identity.<br />Your device.<br />Your control.</h2><p>Sign in with a passkey instead of a password. Your biometric data stays on your device.</p><p className="hint">CyberCup 6.0 · TrustX SovereignPass</p></aside>
      <div className="card">{user ? <DashboardPage user={user} onLogout={() => setUser(null)} /> : <>
        <nav aria-label="Account access"><button aria-current={page === 'login' ? 'page' : undefined} onClick={() => setPage('login')}>Sign in</button><button aria-current={page === 'register' ? 'page' : undefined} onClick={() => setPage('register')}>Create account</button></nav>
        {page === 'login' ? <LoginPage onLogin={setUser} /> : <RegisterPage onRegistered={setCodes} />}
      </>}</div>
    </main>
    {codes.length > 0 && <RecoveryModal codes={codes} onSaved={() => { setCodes([]); setPage('login'); }} />}
    <footer>Passkey onboarding · Day 2 preparation</footer>
  </>;
}
