import { ApiError } from './api';
import type { ActiveSession, AuditEvent, Device, KioskChallenge, RecoveryTicket, Session, User } from './types';
type Account = { user: User; codes: Set<string>; devices: Device[] };
// shortcut: preview data is tab-local, use live APIs for cross-device and security verification.
const accounts = new Map<string, Account>();
let session: Session | undefined;
const tickets = new Map<string, { username: string; code: string; expiresAt: number }>();
const kiosks = new Map<string, KioskChallenge & { authorized?: User; claimed?: boolean }>();
const sessions: ActiveSession[] = [];
const logs: AuditEvent[] = [];
function addAccount(username: string, role: User['role'] = 'USER'): Account {
  const account: Account = { user: { id: `demo-${username}`, username, role }, codes: new Set(Array.from({ length: 8 }, (_, i) => `DEMO-ONLY-000${i + 1}`)), devices: [{ id: crypto.randomUUID(), name: 'Demo laptop', status: 'ACTIVE', lastUsed: new Date().toISOString() }] };
  accounts.set(username, account); return account;
}
addAccount('demo'); addAccount('demo-admin', 'ADMIN');
function event(eventType: string, username = session?.user.username ?? 'demo') {
  logs.unshift({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), eventType, userId: username, ipAddress: '127.0.0.1', details: { preview: true } });
}
function signedIn(): Account {
  if (!session) throw new ApiError(401);
  return accounts.get(session.user.username)!;
}
function startSession(user: User, isKiosk = false): Session {
  session = { user, isKiosk, expiresAt: Date.now() + (isKiosk ? 15 * 60_000 : 24 * 60 * 60_000) };
  sessions.push({ sessionId: crypto.randomUUID(), username: user.username, isKiosk, ipAddress: '127.0.0.1', userAgent: 'UI preview', createdAt: new Date().toISOString(), expiresAt: session.expiresAt! });
  event('USER_LOGIN_SUCCESS', user.username); return session;
}
export async function mockRequest<T>(path: string, body?: unknown): Promise<T> {
  const input = (body ?? {}) as Record<string, string>;
  let result: unknown;
  if (path.startsWith('/admin/') && signedIn().user.role !== 'ADMIN') throw new ApiError(403);
  switch (path) {
    case '/auth/register-verify': {
      const name = input.username.trim().toLowerCase();
      if (!name || accounts.has(name)) throw new ApiError(400);
      const account = addAccount(name); result = { success: true, recoveryCodes: [...account.codes] }; break;
    }
    case '/auth/login-verify': {
      const account = accounts.get(input.username.trim().toLowerCase());
      if (!account || !account.devices.some(device => device.status === 'ACTIVE')) throw new ApiError(401);
      result = { success: true, ...startSession(account.user) }; break;
    }
    case '/auth/session': signedIn(); result = session; break;
    case '/auth/logout': {
      const account = signedIn();
      for (let i = sessions.length - 1; i >= 0; i--) if (sessions[i].username === account.user.username) sessions.splice(i, 1);
      session = undefined; result = { success: true }; break;
    }
    case '/devices/list': result = { devices: signedIn().devices }; break;
    case '/devices/register-challenge': signedIn(); result = {}; break;
    case '/devices/register-verify': {
      signedIn().devices.push({ id: crypto.randomUUID(), name: input.deviceName, status: 'ACTIVE', lastUsed: new Date().toISOString() });
      event('DEVICE_REGISTERED'); result = { success: true }; break;
    }
    case '/devices/revoke': {
      const account = signedIn();
      const device = account.devices.find(device => device.id === input.credentialId && device.status === 'ACTIVE');
      if (!device) throw new ApiError(400);
      device.status = 'REVOKED'; event('DEVICE_REVOKED'); result = { success: true };
      if (!account.devices.some(device => device.status === 'ACTIVE')) {
        session = undefined; window.dispatchEvent(new Event('trustx-session-ended'));
      }
      break;
    }
    case '/recovery/verify-code': {
      const username = input.username.trim().toLowerCase();
      if (!accounts.get(username)?.codes.has(input.recoveryCode)) throw new ApiError(400);
      const recoveryTicket = crypto.randomUUID(); const expiresAt = Date.now() + 300_000;
      tickets.set(recoveryTicket, { username, code: input.recoveryCode, expiresAt });
      result = { success: true, recoveryTicket, expiresAt, registrationOptions: {} } as RecoveryTicket; break;
    }
    case '/recovery/complete': {
      const ticket = tickets.get(input.recoveryTicket);
      if (!ticket || ticket.expiresAt <= Date.now() || ticket.username !== input.username.trim().toLowerCase()) throw new ApiError(400);
      const account = accounts.get(ticket.username)!;
      if (!account.codes.has(ticket.code)) throw new ApiError(400);
      account.codes.delete(ticket.code); tickets.delete(input.recoveryTicket);
      account.devices.forEach(device => { device.status = 'REVOKED'; });
      account.devices.push({ id: crypto.randomUUID(), name: 'Replacement demo passkey', status: 'ACTIVE', lastUsed: new Date().toISOString() });
      for (let i = sessions.length - 1; i >= 0; i--) if (sessions[i].username === account.user.username) sessions.splice(i, 1);
      startSession(account.user); event('RECOVERY_CODE_CONSUMED'); result = { success: true }; break;
    }
    case '/kiosk/qr-challenge': {
      const kioskSessionId = crypto.randomUUID();
      const challenge: KioskChallenge = { kioskSessionId, kioskClientSecret: crypto.randomUUID(), qrData: `${window.location.origin}/kiosk-auth?sid=${kioskSessionId}&token=DEMO-ONLY`, displayCode: 42, expiresAt: Date.now() + 120_000 };
      kiosks.set(kioskSessionId, challenge); result = challenge; break;
    }
    case '/kiosk/qr-poll': {
      const kiosk = kiosks.get(input.kioskSessionId);
      if (!kiosk || kiosk.kioskClientSecret !== input.kioskClientSecret) throw new ApiError(403);
      if (kiosk.expiresAt <= Date.now() || kiosk.claimed) { result = { status: 'EXPIRED' }; break; }
      if (!kiosk.authorized) { result = { status: 'PENDING' }; break; }
      kiosk.claimed = true; result = { status: 'AUTHORIZED', ...startSession(kiosk.authorized, true) }; break;
    }
    case '/kiosk/mock-authorize': {
      const kiosk = kiosks.get(input.kioskSessionId);
      if (!kiosk || kiosk.expiresAt <= Date.now()) throw new ApiError(400);
      kiosk.authorized = accounts.get('demo')!.user; result = { success: true }; break;
    }
    case '/kiosk/qr-auth-challenge': {
      if (!accounts.has(input.username)) throw new ApiError(400);
      result = { displayCode: 42 }; break;
    }
    case '/kiosk/qr-authorize': result = { success: true }; break;
    case '/admin/credentials': result = { credentials: [...accounts.values()].flatMap(account => account.devices.map(device => ({ id: device.id, username: account.user.username, deviceName: device.name, status: device.status, createdAt: device.lastUsed, lastUsedAt: device.lastUsed }))) }; break;
    case '/admin/sessions': result = { sessions }; break;
    case '/admin/audit-logs': result = { logs }; break;
    case '/admin/sessions/terminate': {
      const index = sessions.findIndex(item => item.sessionId === input.sessionId);
      if (index < 0) throw new ApiError(400);
      const [removed] = sessions.splice(index, 1); event('SESSION_TERMINATED'); result = { success: true };
      if (removed.username === session?.user.username) { session = undefined; window.dispatchEvent(new Event('trustx-session-ended')); }
      break;
    }
    case '/admin/attack-results':
    case '/admin/attacks/run': result = { runId: 'preview-not-a-real-run', timestamp: new Date().toISOString(), probes: ['Origin mismatch', 'Challenge replay', 'Recovery reuse', 'Revoked credential', 'Terminated session', 'AI tampering', 'Stolen cookie', 'Step-up replay'].map((name, i) => ({ id: String(i + 1), name, status: 'SKIPPED', detail: 'UI preview only. No security probe was executed.' })) }; break;
    default: throw new ApiError(404);
  }
  return structuredClone(result) as T;
}
