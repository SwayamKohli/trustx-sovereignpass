import { tr } from '../services/i18n';
// Passkey Biometric Ceremony Modal Component
// Owner: Ananya (Role 2 — Product, UI/UX & Admin SOC Lead)
import { useState, type FormEvent } from 'react';
import { addDevice, friendlyError } from '../services/api';
import { Dialog } from './Dialog';
export function PasskeyModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [securityKey, setSecurityKey] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || !name.trim()) return;
    setBusy(true); setError('');
    try { await addDevice(name.trim(), securityKey); onAdded(); onClose(); }
    catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }
  return <Dialog title={tr("Add a passkey", "पासकी जोड़ें")} onClose={onClose} busy={busy}>
    <p>{tr("Use a trusted device or security key. Your browser will guide you through enrollment.", "विश्वसनीय डिवाइस या सुरक्षा कुंजी इस्तेमाल करें। पहले मौजूदा पासकी से मंज़ूरी दें, फिर नई पासकी का ब्राउज़र संदेश पूरा करें।")}</p>
    <form onSubmit={submit}><label htmlFor="device-name">{tr("Device name", "डिवाइस का नाम")}</label><input id="device-name" required maxLength={100} value={name} onChange={event => setName(event.target.value)} disabled={busy} />
      {error && <p role="alert" className="error">{error}</p>}
      <label htmlFor="new-key-method">{tr('New passkey method', 'नई पासकी का तरीका')}</label><select id="new-key-method" value={securityKey?'security-key':'auto'} onChange={e=>setSecurityKey(e.target.value==='security-key')} disabled={busy}><option value="auto">{tr('Any supported authenticator', 'कोई समर्थित प्रमाणक')}</option><option value="security-key">{tr('FIDO2 security key · no smartphone', 'FIDO2 सुरक्षा कुंजी · स्मार्टफोन नहीं')}</option></select>
      <button disabled={busy}>{busy ? tr("Complete the passkey prompt…", "पासकी संदेश पूरा करें…") : tr("Enroll passkey", "पासकी पंजीकृत करें")}</button>
    </form>
  </Dialog>;
}
