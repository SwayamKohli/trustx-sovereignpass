import { startAuthentication, startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { clearDeviceKey, createProof, publicDeviceKey } from './dpop';
import { tr } from './i18n';
import type { AttackReport, ChainReport, Credential, ActiveSession, AuditEvent, Device, KioskChallenge, KioskPoll, PhoneChallenge, RecoveryTicket, Session, User } from './types';
export type { User } from './types';
export type RegistrationResult = { success: true; recoveryCodes: string[] };
export const mockMode = import.meta.env.MODE === 'mock';
export class ApiError extends Error {
  constructor(public status: number, public code = '', public details: Record<string, unknown> = {}) { super('API request failed'); }
}
export type LoginCheck = { pendingId: string; authenticationOptions: PublicKeyCredentialRequestOptionsJSON; risk: { score: number; level: string; reasons: string[] } };
export class LoginCheckRequired extends Error {
  constructor(public check: LoginCheck) { super('Extra passkey verification required'); }
}
type ErrorBody = { error?: string; intentId?: string; intentHash?: string; stepUpOptions?: PublicKeyCredentialRequestOptionsJSON };

async function send(path: string, serialized: string | undefined, protectedRequest: boolean, token?: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (serialized !== undefined) headers['Content-Type'] = 'application/json';
  if (protectedRequest) headers.DPoP = await createProof(serialized === undefined ? 'GET' : 'POST', `/api${path}`);
  if (token) headers['X-Step-Up-Token'] = token;
  return fetch(`/api${path}`, { method: serialized === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers, body: serialized, signal: AbortSignal.timeout(30_000) });
}
async function decode<T>(response: Response, protectedRequest: boolean): Promise<T> {
  if (!response.ok) {
    const data: ErrorBody = await response.json().catch(() => ({}));
    if (protectedRequest && response.status === 401) window.dispatchEvent(new Event('trustx-session-ended'));
    throw new ApiError(response.status, data.error, data);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
export async function request<T>(path: string, body?: unknown, protectedRequest = true): Promise<T> {
  if (!/^\/[a-z0-9/-]+$/i.test(path)) throw new Error('Invalid API path');
  if (mockMode) return (await import('./mock')).mockRequest<T>(path, body);
  const serialized = body === undefined ? undefined : JSON.stringify(body);
  let response = await send(path, serialized, protectedRequest);
  if (protectedRequest && response.status === 403) {
    const data: ErrorBody = await response.clone().json().catch(() => ({}));
    if (data.error === 'STEP_UP_REQUIRED') {
      const challenge = data.stepUpOptions && data.intentId ? { intentId: data.intentId, stepUpOptions: data.stepUpOptions }
        : await decode<{ intentId: string; stepUpOptions: PublicKeyCredentialRequestOptionsJSON }>(await send('/auth/step-up-challenge', JSON.stringify({ method: body === undefined ? 'GET' : 'POST', route: `/api${path}`, body, intentHash: data.intentHash }), true), true);
      const assertionResponse = await startAuthentication({ optionsJSON: challenge.stepUpOptions });
      const verified = await decode<{ success: boolean; stepUpToken: string }>(await send('/auth/step-up-verify', JSON.stringify({ intentId: challenge.intentId, assertionResponse }), true), true);
      if (verified.success !== true || typeof verified.stepUpToken !== 'string') throw new Error('Invalid step-up response');
      // Replay the original serialized bytes once, with a new DPoP proof. Never retry a consumed step-up token.
      response = await send(path, serialized, true, verified.stepUpToken);
    }
  }
  return decode<T>(response, protectedRequest);
}
export function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return tr("Your session or passkey could not be verified. Please sign in again.", "आपके सत्र या पासकी की पुष्टि नहीं हुई। दोबारा साइन इन करें।");
    if (error.status === 429) return tr("Too many attempts. Please wait before trying again.", "बहुत अधिक कोशिशें हुईं। फिर प्रयास करने से पहले प्रतीक्षा करें।");
    if (error.status === 403) return tr("Permission or fresh passkey approval is required. Please try again.", "अनुमति या नई पासकी मंज़ूरी चाहिए। फिर प्रयास करें।");
    if (error.status === 404) {
      if (error.code && error.code.toLowerCase().includes('user')) return tr("Username not registered. Please create an account first.", "उपयोगकर्ता नाम पंजीकृत नहीं है। पहले खाता बनाएँ।");
      return tr("This service is not available on the connected backend yet.", "जुड़े बैकएंड पर यह सेवा उपलब्ध नहीं है।");
    }
    if (error.status === 400) return tr("The request is invalid, expired, or already used. Check your details and try again.", "अनुरोध अमान्य, समाप्त या इस्तेमाल हो चुका है। जानकारी जाँचकर फिर कोशिश करें।");
    return tr("The service is unavailable. Please try again later.", "सेवा उपलब्ध नहीं है। बाद में फिर कोशिश करें।");
  }
  if (error instanceof Error && ['NotAllowedError', 'AbortError'].includes(error.name)) return tr("The passkey prompt was cancelled or timed out. You can try again.", "पासकी संदेश रद्द हुआ या समय समाप्त हुआ। फिर कोशिश कर सकते हैं।");
  if (error instanceof Error && error.name === 'InvalidStateError') return tr("A passkey may already exist on this device. Try signing in.", "इस डिवाइस पर पासकी पहले से हो सकती है। साइन इन करके देखें।");
  return tr("Unable to complete this action. Check your connection and browser storage, then try again.", "कार्रवाई पूरी नहीं हुई। कनेक्शन और ब्राउज़र संग्रह जाँचकर फिर कोशिश करें।");
}
function checkBrowser() {
  if (!window.isSecureContext || !browserSupportsWebAuthn()) throw new Error('WebAuthn unavailable');
}
function requireSuccess(result: { success: boolean }): void { if (result?.success !== true) throw new Error('Server did not confirm the action'); }
function requireSession(result: Session): Session {
  if (!result?.user || !['USER', 'ADMIN'].includes(result.user.role) || typeof result.user.username !== 'string' || typeof result.user.id !== 'string') throw new Error('Invalid session response');
  if (result.isKiosk && (typeof result.expiresAt !== 'number' || !Number.isFinite(result.expiresAt))) throw new Error('Missing kiosk expiry');
  return result;
}
export async function register(username: string, securityKey = false): Promise<RegistrationResult> {
  let attestationResponse;
  if (!mockMode) {
    checkBrowser();
    const optionsJSON = await request<PublicKeyCredentialCreationOptionsJSON>('/auth/register-challenge', { username, ...(securityKey ? { authenticator: 'security-key' } : {}) }, false);
    attestationResponse = await startRegistration({ optionsJSON });
  }
  const result = await request<RegistrationResult>('/auth/register-verify', { username, attestationResponse }, false);
  requireSuccess(result);
  if (!Array.isArray(result.recoveryCodes) || result.recoveryCodes.length !== 8 || !result.recoveryCodes.every(code => typeof code === 'string')) throw new Error('Invalid registration response');
  return result;
}
export async function login(username: string, securityKey = false): Promise<User> {
  let assertionResponse;
  if (!mockMode) {
    checkBrowser();
    const optionsJSON = await request<PublicKeyCredentialRequestOptionsJSON>('/auth/login-challenge', { username }, false);
    if (securityKey) optionsJSON.hints = ['security-key'];
    assertionResponse = await startAuthentication({ optionsJSON });
  }
  let result: { success: boolean } & Session;
  try { result = await request('/auth/login-verify', { username, assertionResponse, dpopPublicKey: mockMode ? undefined : await publicDeviceKey() }, false); }
  catch (error) {
    if (error instanceof ApiError && error.code === 'LOGIN_EXTRA_CHECK_REQUIRED') {
      const check = error.details as unknown as LoginCheck;
      if (!check.pendingId || !check.authenticationOptions?.challenge || !Array.isArray(check.risk?.reasons)) throw new Error('Invalid login check');
      throw new LoginCheckRequired(check);
    }
    throw error;
  }
  requireSuccess(result);
  return requireSession(result).user;
}
export async function finishLoginCheck(check: LoginCheck): Promise<User> {
  const assertionResponse = await startAuthentication({ optionsJSON: check.authenticationOptions });
  const result = await request<{ success: boolean } & Session>('/auth/login-extra-verify', { pendingId: check.pendingId, assertionResponse }, false);
  requireSuccess(result); return requireSession(result).user;
}
export async function currentSession(): Promise<Session> { return requireSession(await request('/auth/session')); }
export async function logout(): Promise<void> {
  const result = await request<{ success: boolean } | undefined>('/auth/logout', {});
  if (result !== undefined) requireSuccess(result);
  if (!mockMode) await clearDeviceKey();
}
export async function verifyRecovery(username: string, recoveryCode: string): Promise<RecoveryTicket> {
  const ticket = await request<RecoveryTicket>('/recovery/verify-code', { username, recoveryCode }, false);
  requireSuccess(ticket);
  if (!ticket.recoveryTicket || !ticket.registrationOptions || !Number.isFinite(ticket.expiresAt)) throw new Error('Invalid recovery response');
  return ticket;
}
export async function completeRecovery(username: string, ticket: RecoveryTicket): Promise<void> {
  if (!mockMode) checkBrowser();
  const attestationResponse = mockMode ? undefined : await startRegistration({ optionsJSON: ticket.registrationOptions });
  const result = await request<{ success: boolean }>('/recovery/complete', { username, recoveryTicket: ticket.recoveryTicket, attestationResponse, dpopPublicKey: mockMode ? undefined : await publicDeviceKey() }, false);
  requireSuccess(result);
}
export async function addDevice(deviceName: string, securityKey = false): Promise<void> {
  const optionsJSON = await request<PublicKeyCredentialCreationOptionsJSON>('/devices/register-challenge', securityKey ? {authenticator:'security-key'} : {});
  const attestationResponse = mockMode ? undefined : await startRegistration({ optionsJSON });
  requireSuccess(await request('/devices/register-verify', { deviceName, attestationResponse }));
}
export async function revokeDevice(credentialId: string): Promise<void> { requireSuccess(await request('/devices/revoke', { credentialId })); }
const validString = (value: unknown): value is string => typeof value === 'string';
const validDate = (value: unknown) => validString(value) && Number.isFinite(Date.parse(value));
const validStatus = (value: unknown) => value === 'ACTIVE' || value === 'REVOKED';
async function list<T>(path: string, key: string, valid: (item: Record<string, unknown>) => boolean): Promise<T[]> {
  const data = await request<Record<string, unknown>>(path);
  const items = data?.[key];
  if (!Array.isArray(items) || !items.every(item => item && typeof item === 'object' && valid(item))) throw new Error('Invalid list response');
  return items as T[];
}
export const listDevices = async () => ({ devices: await list<Device>('/devices/list', 'devices', item => validString(item.id) && validString(item.name) && validStatus(item.status) && validDate(item.lastUsed)) });
export const adminCredentials = async () => ({ credentials: await list<Credential>('/admin/credentials', 'credentials', item => validString(item.id) && validString(item.username) && validString(item.deviceName) && validStatus(item.status) && validDate(item.createdAt) && validDate(item.lastUsedAt)) });
export const adminSessions = async () => ({ sessions: await list<ActiveSession>('/admin/sessions', 'sessions', item => validString(item.sessionId) && validString(item.username) && typeof item.isKiosk === 'boolean' && validString(item.ipAddress) && validString(item.userAgent) && validDate(item.createdAt) && typeof item.expiresAt === 'number' && Number.isFinite(item.expiresAt)) });
export const adminLogs = async () => ({ logs: await list<AuditEvent>('/admin/audit-logs', 'logs', item => validString(item.id) && validString(item.eventType) && validDate(item.timestamp) && (item.userId === null || validString(item.userId)) && !!item.details && typeof item.details === 'object') });
export async function terminateSession(sessionId: string): Promise<void> { requireSuccess(await request('/admin/sessions/terminate', { sessionId })); }
export function validateAttackReport(data: AttackReport): AttackReport {
  if (!data || !validString(data.runId) || !validDate(data.timestamp) || !Array.isArray(data.probes) || data.probes.length === 0 || !data.probes.every(item => item && validString(item.id) && validString(item.name) && validString(item.detail) && ['PASS', 'FAIL', 'SKIPPED'].includes(item.status)) || new Set(data.probes.map(item => item.id)).size !== data.probes.length) throw new Error('Invalid attack report');
  return data;
}
export const attackReport = async () => {
  try { return validateAttackReport(await request<AttackReport>('/admin/attack-results')); }
  catch (error) { if (error instanceof ApiError && error.status === 404 && error.code === 'NO_PROBE_RUN_YET') return undefined; throw error; }
};
export const runAttacks = async () => validateAttackReport(await request<AttackReport>('/admin/attacks/run', {}));
export const verifyChain = async () => {
  const result = await request<ChainReport>('/admin/audit-chain/verify', {});
  if (typeof result?.intact !== 'boolean' || !Number.isInteger(result.checkedEvents) || result.checkedEvents < 0 || !validDate(result.verifiedAt)) throw new Error('Invalid chain report');
  return result;
};
export const createKiosk = async () => request<KioskChallenge>('/kiosk/qr-challenge', { dpopPublicKey: mockMode ? undefined : await publicDeviceKey() }, false);
export const pollKiosk = (challenge: KioskChallenge) => request<KioskPoll>('/kiosk/qr-poll', { kioskSessionId: challenge.kioskSessionId, kioskClientSecret: challenge.kioskClientSecret }, false);
export const phoneChallenge = async (kioskSessionId: string, token: string, username: string) => {
  const result = await request<PhoneChallenge>('/kiosk/qr-auth-challenge', { kioskSessionId, token, username }, false);
  if (!result || !Number.isInteger(result.displayCode) || result.displayCode < 0 || result.displayCode > 99) throw new Error('Invalid confirmation code');
  return result;
};
export async function authorizeKiosk(kioskSessionId: string, token: string, username: string, options: PhoneChallenge): Promise<void> {
  const { displayCode, ...optionsJSON } = options;
  const assertionResponse = mockMode ? undefined : await startAuthentication({ optionsJSON });
  requireSuccess(await request('/kiosk/qr-authorize', { kioskSessionId, token, username, confirmedCode: displayCode, assertionResponse }, false));
}
