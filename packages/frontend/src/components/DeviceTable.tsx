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
    {devices.length === 0 ? <p>No enrolled devices were returned.</p> : <div className="table-scroll"><table>
      <caption>Your passkeys and devices</caption><thead><tr><th scope="col">Device</th><th scope="col">Last used</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
      <tbody>{devices.map(device => <tr key={device.id}><td>{device.name}<small className="identifier">{device.id}</small></td><td>{new Date(device.lastUsed).toLocaleString()}</td><td><span className={`badge ${device.status.toLowerCase()}`}>{device.status}</span></td><td><button className="secondary" disabled={device.status === 'REVOKED' || busy} onClick={() => { setError(''); setTarget(device); }} aria-label={`Revoke ${device.name}`}>Revoke</button></td></tr>)}</tbody>
    </table></div>}
    {target && <Dialog title={`Revoke ${target.name}?`} onClose={() => setTarget(undefined)} busy={busy}>
      <p>This passkey will stop working and its sessions will be terminated by the server. Revoking your current passkey may sign you out. Keep a working passkey or saved recovery code.</p>
      <p className="hint">A fresh passkey confirmation may be requested for this sensitive action.</p>
      {error && <p role="alert" className="error">{error}</p>}
      <button onClick={revoke} disabled={busy}>{busy ? 'Revoking…' : 'Confirm revocation'}</button>
    </Dialog>}
  </>;
}
