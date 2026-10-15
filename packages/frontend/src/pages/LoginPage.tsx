// Citizen Login View (Passwordless Passkey Ceremony)
// Owner: Ananya (Role 2 — Product, UI/UX & Admin SOC Lead)
import { AuthForm } from '../components/AuthForm';
import { login, currentSession } from '../services/api';
import type { Session } from '../services/types';
export function LoginPage({ onLogin }: { onLogin: (session: Session) => void }) {
  return <AuthForm kind="login" onSubmit={async username => { await login(username); onLogin(await currentSession()); }} />;
}
