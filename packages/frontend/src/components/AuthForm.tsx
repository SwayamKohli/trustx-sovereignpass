import { useState, type FormEvent } from 'react';
import { friendlyError, mockMode } from '../services/api';
import { tr } from '../services/i18n';
import { AudioHelp } from './AudioHelp';
export function AuthForm({ kind, securityKey = false, onSubmit }: { kind: 'register' | 'login'; securityKey?: boolean; onSubmit: (username: string, useSecurityKey: boolean) => Promise<void> }) {
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [useSecurityKey, setUseSecurityKey] = useState(securityKey);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const name = username.trim();
    if (!name) { setError(tr('Enter your username.', 'अपना उपयोगकर्ता नाम भरें।')); return; }
    setBusy(true); setError('');
    try {
      await onSubmit(name, useSecurityKey);
    } catch (err) {
      console.error('[TrustX WebAuthn Error]:', err);
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }
  return <form onSubmit={submit} aria-busy={busy}>
    <p className="eyebrow">{kind === 'register' ? tr('Your first step', 'आपका पहला कदम') : tr('Welcome back', 'वापस स्वागत है')}</p>
    <h1>{kind === 'register' ? tr('Create your passkey', 'अपनी पासकी बनाएँ') : tr('Sign in securely', 'सुरक्षित साइन इन करें')}</h1>
    <p>{tr('No passwords. Use your fingerprint, face recognition, device PIN, or security key.', 'पासवर्ड नहीं। उँगली, चेहरा, डिवाइस PIN या सुरक्षा कुंजी इस्तेमाल करें।')}</p>
    <label htmlFor="username">{tr('Username', 'उपयोगकर्ता नाम')}</label>
    <input id="username" name="username" autoComplete="username webauthn" required maxLength={100} value={username} onChange={event => setUsername(event.target.value)} disabled={busy} />
    <label htmlFor="auth-method">{tr('Passkey method', 'पासकी का तरीका')}</label><select id="auth-method" value={useSecurityKey ? 'security-key' : 'auto'} onChange={event => setUseSecurityKey(event.target.value === 'security-key')} disabled={busy}><option value="auto">{tr('This device or another available passkey', 'यह डिवाइस या कोई उपलब्ध पासकी')}</option><option value="security-key">{tr('FIDO2 security key · no smartphone needed', 'FIDO2 सुरक्षा कुंजी · स्मार्टफोन जरूरी नहीं')}</option></select>
    <p className="hint">{mockMode ? tr('Preview only: no real passkey or session is created.', 'केवल पूर्वावलोकन: असली पासकी या सत्र नहीं बनता।') : useSecurityKey ? tr('Insert a compatible FIDO2 key. Enter its PIN only in the browser prompt, then touch the key. Ordinary storage USB drives cannot authenticate.', 'सही FIDO2 कुंजी लगाएँ। केवल ब्राउज़र में उसका PIN भरें, फिर कुंजी छुएँ। साधारण पेन ड्राइव से पहचान नहीं होती।') : tr('Touch your fingerprint sensor or insert your security key when prompted.', 'ब्राउज़र के कहने पर उँगली लगाएँ या सुरक्षा कुंजी लगाएँ।')}</p>
    {!mockMode && (!window.isSecureContext || !window.PublicKeyCredential) && <p role="alert">{tr('Use a passkey-capable browser over HTTPS or localhost.', 'पासकी वाला ब्राउज़र HTTPS या localhost पर खोलें।')}</p>}
    {error && <p className="error" role="alert">{error}</p>}
    <button type="submit" disabled={busy}>{busy ? tr('Please wait…', 'कृपया प्रतीक्षा करें…') : kind === 'register' ? tr('Create account', 'खाता बनाएँ') : tr('Sign in with a passkey', 'पासकी से साइन इन करें')}</button>
    <p role="status" className="hint">{busy ? (mockMode ? tr('Loading preview…', 'पूर्वावलोकन खुल रहा है…') : tr('Complete the prompt on your device. Your biometric data stays on your device.', 'अपने डिवाइस का संदेश पूरा करें। बायोमेट्रिक आपके डिवाइस पर ही रहता है।')) : ''}</p>
    <AudioHelp instructions={useSecurityKey ? tr('Type your username. Choose the account button. Insert your FIDO2 security key, use its PIN in the browser prompt and touch the key. Never type that PIN into this page. You do not need a smartphone.', 'अपना उपयोगकर्ता नाम भरें। खाते वाला बटन दबाएँ। FIDO2 सुरक्षा कुंजी लगाएँ, ब्राउज़र में उसका PIN भरें और कुंजी छुएँ। इस पेज पर PIN न भरें। स्मार्टफोन की जरूरत नहीं।') : tr('Type your username, then choose the account button. Complete the trusted browser prompt using your device PIN, fingerprint, face or enrolled security key. Never share a recovery code.', 'उपयोगकर्ता नाम भरकर खाते का बटन दबाएँ। ब्राउज़र के संदेश पर डिवाइस PIN, उँगली, चेहरा या पंजीकृत सुरक्षा कुंजी इस्तेमाल करें। रिकवरी कोड किसी को न बताएँ।')} />
  </form>;
}
