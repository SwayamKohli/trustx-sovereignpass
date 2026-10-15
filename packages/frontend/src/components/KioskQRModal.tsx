import { tr } from '../services/i18n';
// Shared-Device Dynamic QR Code Display Modal
// Owner: Ananya (Role 2 — Product, UI/UX & Admin SOC Lead)
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { createKiosk, currentSession, friendlyError, mockMode, pollKiosk, request } from '../services/api';
import { expiryMilliseconds, type KioskChallenge, type Session } from '../services/types';
import { useNow } from '../services/usePolling';
import { Dialog } from './Dialog';
import { AudioHelp } from './AudioHelp';
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
  return <Dialog title={tr("Sign in on a shared terminal", "साझा टर्मिनल पर साइन इन करें")} onClose={onClose}>
    {['localhost','127.0.0.1'].includes(window.location.hostname) && <p className="banner">{tr('Same-laptop rehearsal mode: this QR points to localhost, not your phone. Use the second-window link below. Real-phone approval requires a reachable trusted HTTPS origin and a passkey registered there.', 'एक लैपटॉप पर अभ्यास: QR localhost का है, फोन पर नहीं खुलेगा। नीचे दूसरी विंडो वाला लिंक चुनें। फोन से मंज़ूरी के लिए सही HTTPS और उसी साइट की पासकी जरूरी है।')}</p>}
    <p>{tr("Scan with your trusted phone. Confirm that the two-digit code matches before approving with a passkey.", "अपने विश्वसनीय फोन से स्कैन करें। पासकी से मंज़ूरी देने से पहले दोनों जगह दो अंकों का कोड मिलाएँ।")}</p>
    {mockMode && <p className="banner">UI simulation only. Use “Simulate phone approval” below; cross-device preview is not supported.</p>}
    {qr && !outOfTime && <img className="qr" src={qr} width={260} height={260} alt={tr("Scan this QR code with your trusted phone to approve this terminal", "टर्मिनल मंज़ूर करने के लिए अपने विश्वसनीय फोन से यह QR स्कैन करें")} />}
    {challenge && !outOfTime && <><p className="confirmation-code" aria-label={`Confirmation code ${String(challenge.displayCode).padStart(2, '0')}`}>{String(challenge.displayCode).padStart(2, '0')}</p><p role="status">{tr("Waiting for phone approval. QR expires in", "फोन की मंज़ूरी बाकी है। QR की समय सीमा")} {Math.max(0, Math.ceil((expiryMilliseconds(challenge.expiresAt) - now) / 1000))} {tr("seconds.", "सेकंड।")}</p></>}
    {challenge && !outOfTime && <a className="button-link secondary" href={challenge.qrData} target="_blank" rel="noreferrer">{tr("Open phone approval in another window", "फोन की मंज़ूरी दूसरी विंडो में खोलें")}</a>}
    {!challenge && !error && <p role="status">{tr("Creating a short-lived QR challenge…", "थोड़े समय का QR बन रहा है…")}</p>}
    {outOfTime && <p role="status">{tr("This QR code expired. Generate a new one to try again.", "QR समाप्त हो गया। फिर कोशिश करने के लिए नया QR बनाएँ।")}</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {mockMode && challenge && !outOfTime && <button onClick={async () => { try { await request('/kiosk/mock-authorize', { kioskSessionId: challenge.kioskSessionId }, false); } catch (err) { setError(friendlyError(err)); } }}>Simulate phone approval</button>}
    <button className="secondary" onClick={() => setRevision(value => value + 1)}>{tr("Generate new QR", "नया QR बनाएँ")}</button>
    <AudioHelp instructions={tr('Only approve the terminal you are using. Open the approval link on your trusted device, check that both two-digit codes match, and approve with your passkey. Never use another person’s identity. Sign out of this terminal when finished.', 'केवल अपने इस्तेमाल वाले टर्मिनल को मंज़ूर करें। विश्वसनीय डिवाइस पर लिंक खोलें, दोनों जगह दो अंकों का कोड मिलाएँ और पासकी से मंज़ूरी दें। किसी और की पहचान इस्तेमाल न करें। काम पूरा होने पर टर्मिनल से साइन आउट करें।')} />
    <p className="hint">{tr("The server must enforce a 15-minute session. No passkey is enrolled on the public terminal.", "सर्वर 15 मिनट का सत्र लागू करता है। सार्वजनिक टर्मिनल पर पासकी नहीं बनती।")}</p>
  </Dialog>;
}
