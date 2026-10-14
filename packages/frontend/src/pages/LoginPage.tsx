// Citizen Login View (Passwordless Passkey Ceremony)
// Owner: Ananya (Role 2 — Product, UI/UX & Admin SOC Lead)
import { AuthForm } from '../components/AuthForm';
import { login, type User } from '../services/api';
export function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  return <AuthForm kind="login" onSubmit={async username => onLogin(await login(username))} />;
}
