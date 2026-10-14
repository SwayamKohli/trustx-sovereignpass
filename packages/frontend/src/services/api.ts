import { startAuthentication, startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
export type User = { id: string; username: string; role: 'USER' | 'ADMIN' };
export type RegistrationResult = { success: true; recoveryCodes: string[] };
export const mockMode = import.meta.env.MODE === 'mock';
export class ApiError extends Error {
  constructor(public status: number) { super('API request failed'); }
}
export async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new ApiError(response.status);
  return response.json();
}
export function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return 'Too many attempts. Please wait before trying again.';
    if (error.status === 401) return 'Sign-in could not be verified. Please try again.';
    if (error.status === 403) return 'You do not have permission to perform this action.';
    if (error.status === 400) return 'The request could not be verified. Check your username and try again.';
    return 'The service is unavailable. Please try again later.';
  }
  if (error instanceof Error && ['NotAllowedError', 'AbortError'].includes(error.name)) return 'The passkey prompt was cancelled or timed out. You can try again.';
  if (error instanceof Error && error.name === 'InvalidStateError') return 'A passkey may already exist on this device. Try signing in.';
  return 'Unable to complete this action. Check your connection and try again.';
}
function checkBrowser() {
  if (!window.isSecureContext || !browserSupportsWebAuthn()) throw new Error('WebAuthn unavailable');
}
// shortcut: mock accounts live only in this tab, replace with backend persistence for integration.
const mockAccounts = new Map<string, User>();
export async function register(username: string): Promise<RegistrationResult> {
  if (mockMode) {
    if (mockAccounts.has(username)) throw new ApiError(400);
    mockAccounts.set(username, { id: `mock-${username}`, username, role: 'USER' });
    return { success: true, recoveryCodes: Array.from({ length: 8 }, (_, i) => `DEMO-ONLY-000${i + 1}`) };
  }
  checkBrowser();
  const optionsJSON = await request<PublicKeyCredentialCreationOptionsJSON>('/auth/register-challenge', { username });
  const attestationResponse = await startRegistration({ optionsJSON });
  const result = await request<RegistrationResult>('/auth/register-verify', { username, attestationResponse });
  if (result.success !== true || !Array.isArray(result.recoveryCodes) || result.recoveryCodes.length !== 8 || !result.recoveryCodes.every(code => typeof code === 'string')) throw new Error('Invalid registration response');
  return result;
}
export async function login(username: string): Promise<User> {
  if (mockMode) {
    const user = mockAccounts.get(username);
    if (!user) throw new ApiError(401);
    return user;
  }
  checkBrowser();
  const optionsJSON = await request<PublicKeyCredentialRequestOptionsJSON>('/auth/login-challenge', { username });
  const assertionResponse = await startAuthentication({ optionsJSON });
  const result = await request<{ success: boolean; user: User }>('/auth/login-verify', { username, assertionResponse });
  if (result.success !== true || !result.user || !['USER', 'ADMIN'].includes(result.user.role) || typeof result.user.username !== 'string') throw new Error('Invalid login response');
  return result.user;
}
export async function logout(): Promise<void> {
  // Proposed contract: Sanchit must implement server-side invalidation before live logout works.
  if (!mockMode) {
    const response = await fetch('/api/auth/logout', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    if (!response.ok) throw new ApiError(response.status);
    if (response.status !== 204 && (await response.json()).success !== true) throw new Error('Invalid logout response');
  }
}
