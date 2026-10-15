// Passkey Biometric Ceremony Modal Component
// Owner: Ananya (Role 2 — Product, UI/UX & Admin SOC Lead)
import { useState, type FormEvent } from 'react';
import { addDevice, friendlyError } from '../services/api';
import { Dialog } from './Dialog';
export function PasskeyModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || !name.trim()) return;
    setBusy(true); setError('');
    try { await addDevice(name.trim()); onAdded(); onClose(); }
    catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }
  return <Dialog title="Add a passkey" onClose={onClose} busy={busy}>
    <p>Use a trusted device or security key. Your browser will guide you through enrollment.</p>
    <form onSubmit={submit}><label htmlFor="device-name">Device name</label><input id="device-name" required maxLength={100} value={name} onChange={event => setName(event.target.value)} disabled={busy} />
      {error && <p role="alert" className="error">{error}</p>}
      <button disabled={busy}>{busy ? 'Complete the passkey prompt…' : 'Enroll passkey'}</button>
    </form>
  </Dialog>;
}
