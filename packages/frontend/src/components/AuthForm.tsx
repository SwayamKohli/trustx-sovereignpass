import { useState, type FormEvent } from 'react';
import { friendlyError, mockMode } from '../services/api';
export function AuthForm({ kind, onSubmit }: { kind: 'register' | 'login'; onSubmit: (username: string) => Promise<void> }) {
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const name = username.trim();
    if (!name) { setError('Enter your username.'); return; }
    setBusy(true); setError('');
    try { await onSubmit(name); } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} aria-busy={busy}>
    <p className="eyebrow">{kind === 'register' ? 'Your first step' : 'Welcome back'}</p>
    <h1>{kind === 'register' ? 'Create your passkey' : 'Sign in securely'}</h1>
    <p>No passwords. Use your fingerprint, face recognition, device PIN, or security key.</p>
    <label htmlFor="username">Username</label>
    <input id="username" name="username" autoComplete="username webauthn" required maxLength={100} value={username} onChange={event => setUsername(event.target.value)} disabled={busy} />
    <p className="hint">{mockMode ? 'Preview only: no real passkey or session is created.' : 'Touch your fingerprint sensor or insert your security key when prompted.'}</p>
    {!mockMode && (!window.isSecureContext || !window.PublicKeyCredential) && <p role="alert">Use a passkey-capable browser over HTTPS or localhost.</p>}
    {error && <p className="error" role="alert">{error}</p>}
    <button type="submit" disabled={busy}>{busy ? 'Please wait…' : kind === 'register' ? 'Create account' : 'Sign in with a passkey'}</button>
    <p role="status" className="hint">{busy ? (mockMode ? 'Loading preview…' : 'Complete the prompt on your device. Your biometric data stays on your device.') : ''}</p>
  </form>;
}
