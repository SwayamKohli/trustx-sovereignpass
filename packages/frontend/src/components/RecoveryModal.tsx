// Emergency Recovery Codes Modal & Input Form Component
// Owner: Ananya (Role 2 — Product, UI/UX & Admin SOC Lead)
import { useEffect, useRef, useState } from 'react';
import { mockMode } from '../services/api';
import { containDialogFocus } from './Dialog';
import { tr } from '../services/i18n';
export function RecoveryModal({ codes, onSaved, rotation = false }: { codes: string[]; onSaved: () => void; rotation?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  async function copy() {
    try { await navigator.clipboard.writeText(codes.join('\n')); setMessage(tr('Codes copied. Store them somewhere private.', 'कोड कॉपी हुए। इन्हें निजी जगह रखें।')); }
    catch { setMessage(tr('Copy was unavailable. Use Download instead.', 'कॉपी नहीं हो सकी। डाउनलोड इस्तेमाल करें।')); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([`${mockMode ? 'DEMO ONLY — not valid recovery codes' : 'TrustX emergency recovery codes — keep private'}\n${codes.join('\n')}\n`], { type: 'text/plain' }));
    const link = document.createElement('a'); link.href = url; link.download = 'trustx-recovery-codes.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(tr('Download requested. Check the file before continuing.', 'डाउनलोड शुरू किया। आगे बढ़ने से पहले फाइल जाँचें।'));
  }
  return <dialog ref={dialog} aria-labelledby="recovery-title" onKeyDown={containDialogFocus} onCancel={event => event.preventDefault()}>
    <p className="eyebrow">{rotation ? tr('Recovery codes replaced', 'रिकवरी कोड बदले गए') : tr('Account created', 'खाता बन गया')}</p><h2 id="recovery-title">{tr('Save your emergency codes', 'अपने आपातकालीन कोड सुरक्षित रखें')}</h2>
    <p>{tr('Each code can recover your account once. Keep these private and separate from your device. They will not be shown again.', 'हर कोड से एक बार खाता वापस मिलेगा। इन्हें निजी और डिवाइस से अलग जगह रखें। ये दोबारा नहीं दिखेंगे।')}</p>
    {rotation && <p className="banner">{tr('All previous recovery codes are now invalid. Save this new set before leaving.', 'सभी पुराने रिकवरी कोड अब अमान्य हैं। पेज छोड़ने से पहले नए कोड सुरक्षित रखें।')}</p>}
    {mockMode && <p className="banner">Demo codes only — these cannot recover a real account.</p>}
    <ul className="codes">{codes.map(code => <li key={code}><code>{code}</code></li>)}</ul>
    <div className="actions"><button onClick={copy}>{tr('Copy codes', 'कोड कॉपी करें')}</button><button className="secondary" onClick={download}>{tr('Download codes', 'कोड डाउनलोड करें')}</button></div>
    <p role="status">{message}</p>
    <label className="checkbox"><input type="checkbox" checked={saved} onChange={event => setSaved(event.target.checked)} />{tr('I saved my codes in a private place.', 'मैंने कोड निजी जगह सुरक्षित रख लिए हैं।')}</label>
    <button disabled={!saved} onClick={onSaved}>{rotation ? tr('Return to account', 'खाते पर वापस जाएँ') : tr('Continue to sign in', 'साइन इन की ओर बढ़ें')}</button>
  </dialog>;
}
