// Emergency Recovery Codes Modal & Input Form Component
// Owner: Ananya (Role 2 — Product, UI/UX & Admin SOC Lead)
import { useEffect, useRef, useState } from 'react';
import { mockMode } from '../services/api';
export function RecoveryModal({ codes, onSaved }: { codes: string[]; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  async function copy() {
    try { await navigator.clipboard.writeText(codes.join('\n')); setMessage('Codes copied. Store them somewhere private.'); }
    catch { setMessage('Copy was unavailable. Use Download instead.'); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([`${mockMode ? 'DEMO ONLY — not valid recovery codes' : 'TrustX emergency recovery codes — keep private'}\n${codes.join('\n')}\n`], { type: 'text/plain' }));
    const link = document.createElement('a'); link.href = url; link.download = 'trustx-recovery-codes.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Download requested. Check the file before continuing.');
  }
  return <dialog ref={dialog} aria-labelledby="recovery-title" onCancel={event => event.preventDefault()}>
    <p className="eyebrow">Account created</p><h2 id="recovery-title">Save your emergency codes</h2>
    <p>Each code can recover your account once. Keep these private and separate from your device. They will not be shown again.</p>
    {mockMode && <p className="banner">Demo codes only — these cannot recover a real account.</p>}
    <ul className="codes">{codes.map(code => <li key={code}><code>{code}</code></li>)}</ul>
    <div className="actions"><button onClick={copy}>Copy codes</button><button className="secondary" onClick={download}>Download codes</button></div>
    <p role="status">{message}</p>
    <label className="checkbox"><input type="checkbox" checked={saved} onChange={event => setSaved(event.target.checked)} />I saved my codes in a private place.</label>
    <button disabled={!saved} onClick={onSaved}>Continue to sign in</button>
  </dialog>;
}
