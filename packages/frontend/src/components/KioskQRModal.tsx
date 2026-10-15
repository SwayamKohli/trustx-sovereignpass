// Shared-Device Dynamic QR Code Display Modal
// Owner: Ananya (Role 2 — Product, UI/UX & Admin SOC Lead)
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { createKiosk, currentSession, friendlyError, mockMode, pollKiosk, request } from '../services/api';
import { expiryMilliseconds, type KioskChallenge, type Session } from '../services/types';
import { useNow } from '../services/usePolling';
import { Dialog } from './Dialog';
export function KioskQRModal({ onClose, onAuthorized }: { onClose: () => void; onAuthorized: (session: Session) => void }) {
  const [challenge, setChallenge] = useState<KioskChallenge>();
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [expired, setExpired] = useState(false);
  const now = useNow();
  useEffect(() => {
    let active = true;
    setChallenge(undefined); setQr(''); setError(''); setExpired(false);
    void (async () => {
      try {
        const result = await createKiosk();
        const url = new URL(result.qrData);
        if (url.origin !== window.location.origin || url.pathname !== '/kiosk-auth' || url.searchParams.get('sid') !== result.kioskSessionId || !url.searchParams.get('token') || !result.kioskClientSecret || url.href.includes(result.kioskClientSecret) || !Number.isFinite(result.expiresAt) || !Number.isInteger(result.displayCode) || result.displayCode < 0 || result.displayCode > 99) throw new Error('Invalid kiosk response');
        const image = await QRCode.toDataURL(result.qrData, { width: 260, margin: 2 });
        if (active) { setChallenge(result); setQr(image); }
      } catch (err) { if (active) setError(friendlyError(err)); }
    })();
    return () => { active = false; };
  }, [revision]);
  useEffect(() => {
    if (!challenge) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (expiryMilliseconds(challenge!.expiresAt) <= Date.now()) { if (active) setExpired(true); return; }
      let claimed = false;
      try {
        const result = await pollKiosk(challenge!);
        if (!active) return;
        setError('');
        if (result.status === 'EXPIRED') { setExpired(true); return; }
        if (result.status === 'AUTHORIZED') {
          claimed = true;
          // The claim is single-use; never poll it again after authorization.
          const session = result.user?.id && result.user.role && result.expiresAt ? result : await currentSession();
          if (!session.isKiosk || !session.expiresAt) throw new Error('Kiosk session expiry missing');
          if (active) onAuthorized(session); return;
        }
      } catch (err) { if (active) setError(friendlyError(err)); if (claimed) return; }
      if (active) timer = setTimeout(poll, 2000);
    }
    timer = setTimeout(poll, 2000);
    return () => { active = false; clearTimeout(timer); };
  }, [challenge, onAuthorized]);
  const outOfTime = expired || (!!challenge && expiryMilliseconds(challenge.expiresAt) <= now);
  return <Dialog title="Sign in on a shared terminal" onClose={onClose}>
    <p>Scan with your trusted phone. Confirm that the two-digit code matches before approving with a passkey.</p>
    {mockMode && <p className="banner">UI simulation only. Use “Simulate phone approval” below; cross-device preview is not supported.</p>}
    {qr && !outOfTime && <img className="qr" src={qr} width={260} height={260} alt="Scan this QR code with your trusted phone to approve this terminal" />}
    {challenge && !outOfTime && <><p className="confirmation-code" aria-label={`Confirmation code ${String(challenge.displayCode).padStart(2, '0')}`}>{String(challenge.displayCode).padStart(2, '0')}</p><p role="status">Waiting for phone approval. QR expires in {Math.max(0, Math.ceil((expiryMilliseconds(challenge.expiresAt) - now) / 1000))} seconds.</p></>}
    {!challenge && !error && <p role="status">Creating a short-lived QR challenge…</p>}
    {outOfTime && <p role="status">This QR code expired. Generate a new one to try again.</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {mockMode && challenge && !outOfTime && <button onClick={async () => { try { await request('/kiosk/mock-authorize', { kioskSessionId: challenge.kioskSessionId }, false); } catch (err) { setError(friendlyError(err)); } }}>Simulate phone approval</button>}
    <button className="secondary" onClick={() => setRevision(value => value + 1)}>Generate new QR</button>
    <p className="hint">The server must enforce a 15-minute session. No passkey is enrolled on the public terminal.</p>
  </Dialog>;
}
