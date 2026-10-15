import { tr } from '../services/i18n';
// User Dashboard Enrolled Devices Table Component
// Owner: Ananya (Role 2 — Product, UI/UX & Admin SOC Lead)
import { useState } from 'react';
import { friendlyError, revokeDevice } from '../services/api';
import type { Device } from '../services/types';
import { Dialog } from './Dialog';
export function DeviceTable({ devices, onChanged }: { devices: Device[]; onChanged: () => void }) {
  const [target, setTarget] = useState<Device>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function revoke() {
    if (!target || busy) return;
    setBusy(true); setError('');
    try { await revokeDevice(target.id); setTarget(undefined); onChanged(); }
    catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }
  return <>
    {devices.length === 0 ? <p>{tr("No enrolled devices were returned.", "कोई पंजीकृत डिवाइस नहीं मिला।")}</p> : <div className="table-scroll"><table>
      <caption>{tr("Your passkeys and devices", "आपकी पासकी और डिवाइस")}</caption><thead><tr><th scope="col">{tr("Device", "डिवाइस")}</th><th scope="col">{tr("Last used", "आखिरी उपयोग")}</th><th scope="col">{tr("Status", "स्थिति")}</th><th scope="col">{tr("Action", "कार्रवाई")}</th></tr></thead>
      <tbody>{devices.map(device => <tr key={device.id}><td>{device.name}<small className="identifier">{device.id}</small></td><td>{new Date(device.lastUsed).toLocaleString()}</td><td><span className={`badge ${device.status.toLowerCase()}`}>{device.status}</span></td><td><button className="secondary" disabled={device.status === 'REVOKED' || busy} onClick={() => { setError(''); setTarget(device); }} aria-label={`Revoke ${device.name}`}>{tr("Revoke", "रद्द करें")}</button></td></tr>)}</tbody>
    </table></div>}
    {target && <Dialog title={`${tr('Revoke', 'रद्द करें')} ${target.name}?`} onClose={() => setTarget(undefined)} busy={busy}>
      <p>{tr("This passkey will stop working and its sessions will be terminated by the server. Revoking your current passkey may sign you out. Keep a working passkey or saved recovery code.", "यह पासकी और उससे जुड़े सत्र बंद होंगे। अपनी मौजूदा पासकी रद्द करने से साइन आउट हो सकता है। एक काम करने वाली पासकी या सुरक्षित रिकवरी कोड रखें।")}</p>
      <p className="hint">{tr("A fresh passkey confirmation may be requested for this sensitive action.", "इस कार्रवाई के लिए नई पासकी पुष्टि जरूरी हो सकती है।")}</p>
      {error && <p role="alert" className="error">{error}</p>}
      <button onClick={revoke} disabled={busy}>{busy ? tr("Revoking…", "रद्द हो रहा है…") : tr("Confirm revocation", "रद्द करने की पुष्टि करें")}</button>
    </Dialog>}
  </>;
}
