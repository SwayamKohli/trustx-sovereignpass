// Citizen Onboarding & Passkey Registration View
// Owner: Ananya (Role 2 — Product, UI/UX & Admin SOC Lead)
import { AuthForm } from '../components/AuthForm';
import { register } from '../services/api';
export function RegisterPage({ onRegistered }: { onRegistered: (codes: string[]) => void }) {
  return <AuthForm kind="register" onSubmit={async username => onRegistered((await register(username)).recoveryCodes)} />;
}
