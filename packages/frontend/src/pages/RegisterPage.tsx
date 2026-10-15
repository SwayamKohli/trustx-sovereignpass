// Citizen Onboarding & Passkey Registration View
// Owner: Ananya (Role 2 — Product, UI/UX & Admin SOC Lead)
import { AuthForm } from '../components/AuthForm';
import { register } from '../services/api';
export function RegisterPage({ onRegistered, securityKey }: { onRegistered: (codes: string[]) => void; securityKey?: boolean }) {
  return <AuthForm key={String(securityKey)} kind="register" securityKey={securityKey} onSubmit={async (username, useSecurityKey) => onRegistered((await register(username, useSecurityKey)).recoveryCodes)} />;
}
