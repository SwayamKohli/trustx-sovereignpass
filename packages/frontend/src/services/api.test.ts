import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@simplewebauthn/browser', () => ({ startRegistration: vi.fn(), startAuthentication: vi.fn(), browserSupportsWebAuthn: () => true }));
vi.mock('./dpop', () => ({ createProof: vi.fn(), publicDeviceKey: vi.fn(), clearDeviceKey: vi.fn() }));
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { createProof, publicDeviceKey, clearDeviceKey } from './dpop';
import { ApiError, completeRecovery, friendlyError, login, logout, register, request, validateAttackReport, verifyRecovery, LoginCheckRequired, finishLoginCheck } from './api';

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('window', { isSecureContext: true, dispatchEvent: vi.fn() });
  vi.mocked(createProof).mockImplementation(async () => `proof-${crypto.randomUUID()}`);
  vi.mocked(publicDeviceKey).mockResolvedValue({ kty: 'EC', crv: 'P-256', x: 'public-x', y: 'public-y' });
  vi.mocked(clearDeviceKey).mockResolvedValue();
});
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function reply(body: unknown, status = 200) { fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status })); }

describe('real passkey contracts', () => {
  it('does not auto-approve changed-context login or return a fabricated session', async () => {
    const check={pendingId:'pending',authenticationOptions:{challenge:'fresh'},risk:{score:45,level:'MEDIUM',reasons:['BROWSER_CONTEXT_CHANGED']}};
    reply({challenge:'first'});reply({error:'LOGIN_EXTRA_CHECK_REQUIRED',...check},403);
    vi.mocked(startAuthentication).mockResolvedValueOnce({id:'assertion'} as Awaited<ReturnType<typeof startAuthentication>>);
    await expect(login('alice')).rejects.toBeInstanceOf(LoginCheckRequired);
    expect(startAuthentication).toHaveBeenCalledTimes(1);expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.mocked(startAuthentication).mockRejectedValueOnce(new DOMException('cancelled','NotAllowedError'));
    await expect(finishLoginCheck(check)).rejects.toMatchObject({name:'NotAllowedError'});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('requests an actual cross-platform registration route when a security key is chosen', async () => {
    const options={challenge:'key-challenge',authenticatorSelection:{authenticatorAttachment:'cross-platform',userVerification:'required'}};
    reply(options);reply({success:true,recoveryCodes:Array.from({length:8},(_,i)=>`code-${i}`)});
    vi.mocked(startRegistration).mockResolvedValueOnce({id:'usb'} as Awaited<ReturnType<typeof startRegistration>>);
    await register('alice',true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({username:'alice',authenticator:'security-key'});
    expect(startRegistration).toHaveBeenCalledWith({optionsJSON:options});
  });
  it('passes server options to registration and returns eight server codes', async () => {
    const options = { challenge: 'server-challenge' };
    const attestation = { id: 'credential' };
    vi.mocked(startRegistration).mockResolvedValueOnce(attestation as Awaited<ReturnType<typeof startRegistration>>);
    reply(options);
    const recoveryCodes = Array.from({ length: 8 }, (_, i) => `code-${i}`);
    reply({ success: true, recoveryCodes });
    expect(await register('alice')).toEqual({ success: true, recoveryCodes });
    expect(startRegistration).toHaveBeenCalledWith({ optionsJSON: options });
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/register-verify');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ username: 'alice', attestationResponse: attestation });
    expect(fetchMock.mock.calls[1][1].credentials).toBe('same-origin');
  });
  it('does not verify a cancelled ceremony and hides technical exceptions', async () => {
    const error = new DOMException('Raw internal details', 'NotAllowedError');
    reply({ challenge: 'challenge' });
    vi.mocked(startAuthentication).mockRejectedValueOnce(error);
    await expect(login('alice')).rejects.toBe(error);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(friendlyError(error)).toContain('cancelled');
    expect(friendlyError(error)).not.toContain('Raw internal details');
  });
  it('returns only a server-verified login user', async () => {
    const user = { id: 'u1', username: 'alice', role: 'USER' };
    reply({ challenge: 'challenge' }); reply({ success: true, user });
    vi.mocked(startAuthentication).mockResolvedValueOnce({ id: 'credential' } as Awaited<ReturnType<typeof startAuthentication>>);
    expect(await login('alice')).toEqual(user);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/login-verify');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).username).toBe('alice');
  });
  it('rejects malformed recovery-code responses', async () => {
    reply({ challenge: 'challenge' }); reply({ success: true, recoveryCodes: [] });
    vi.mocked(startRegistration).mockResolvedValueOnce({ id: 'credential' } as Awaited<ReturnType<typeof startRegistration>>);
    await expect(register('alice')).rejects.toThrow('Invalid registration response');
  });
  it('preserves logout failures rather than claiming the session ended', async () => {
    reply({ error: 'not implemented' }, 404);
    await expect(logout()).rejects.toMatchObject({ status: 404 });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/logout');
  });
  it('accepts logout with no content but rejects a false success response', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(logout()).resolves.toBeUndefined();
    reply({ success: false });
    await expect(logout()).rejects.toThrow('Server did not confirm');
    reply(null);
    await expect(logout()).rejects.toThrow('Server did not confirm');
  });
  it('rejects non-JSON responses and maps rate limits to readable messages', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>proxy missing</html>'));
    await expect(request('/devices/list')).rejects.toThrow();
    expect(friendlyError(new ApiError(429))).toContain('wait');
  });
  it('sends the public binding key at login and fresh proofs on protected requests', async () => {
    reply({ challenge: 'challenge' }); reply({ success: true, user: { id: 'u1', username: 'alice', role: 'USER' } });
    vi.mocked(startAuthentication).mockResolvedValueOnce({ id: 'credential' } as Awaited<ReturnType<typeof startAuthentication>>);
    await login('alice');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).dpopPublicKey).toMatchObject({ kty: 'EC', crv: 'P-256' });
    expect(fetchMock.mock.calls[0][1].headers.DPoP).toBeUndefined();
    reply({ devices: [] }); reply({ devices: [] });
    await request('/devices/list'); await request('/devices/list');
    expect(fetchMock.mock.calls[2][1].headers.DPoP).not.toBe(fetchMock.mock.calls[3][1].headers.DPoP);
    expect(createProof).toHaveBeenCalledWith('GET', '/api/devices/list');
  });
  it('resumes the identical sensitive request once after step-up, with a fresh proof', async () => {
    const original = { credentialId: 'device-2' };
    reply({ error: 'STEP_UP_REQUIRED', intentId: 'intent-1', stepUpOptions: { challenge: 'stepup' } }, 403);
    reply({ success: true, stepUpToken: 'single-use' }); reply({ success: true });
    vi.mocked(startAuthentication).mockResolvedValueOnce({ id: 'assertion' } as Awaited<ReturnType<typeof startAuthentication>>);
    await request('/devices/revoke', original);
    expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[2][1].body);
    expect(fetchMock.mock.calls[2][1].headers['X-Step-Up-Token']).toBe('single-use');
    expect(fetchMock.mock.calls[0][1].headers.DPoP).not.toBe(fetchMock.mock.calls[2][1].headers.DPoP);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/step-up-verify');
  });
  it('does not repeat a failed business operation using a consumed token', async () => {
    reply({ error: 'STEP_UP_REQUIRED', intentId: 'intent', stepUpOptions: {} }, 403);
    reply({ success: true, stepUpToken: 'single-use' }); reply({ error: 'Business validation failed' }, 400);
    vi.mocked(startAuthentication).mockResolvedValueOnce({ id: 'assertion' } as Awaited<ReturnType<typeof startAuthentication>>);
    await expect(request('/devices/revoke', { credentialId: 'missing' })).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it('uses the separate step-up challenge endpoint when middleware returns only an intent hash', async () => {
    reply({ error: 'STEP_UP_REQUIRED', intentHash: 'body-hash' }, 403);
    reply({ intentId: 'intent', stepUpOptions: {} }); reply({ success: true, stepUpToken: 'token' }); reply({ success: true });
    vi.mocked(startAuthentication).mockResolvedValueOnce({ id: 'assertion' } as Awaited<ReturnType<typeof startAuthentication>>);
    await request('/devices/revoke', { credentialId: 'device' });
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/step-up-challenge');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ method: 'POST', route: '/api/devices/revoke', body: { credentialId: 'device' }, intentHash: 'body-hash' });
  });
  it('does not complete recovery when replacement enrollment is cancelled', async () => {
    reply({ success: true, recoveryTicket: 'ticket', registrationOptions: { challenge: 'replacement' }, expiresAt: Date.now() + 300000 });
    const ticket = await verifyRecovery('alice', 'code');
    vi.mocked(startRegistration).mockRejectedValueOnce(new DOMException('cancelled', 'NotAllowedError'));
    await expect(completeRecovery('alice', ticket)).rejects.toMatchObject({ name: 'NotAllowedError' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/recovery/verify-code');
  });
  it('clears the rendered session on protected 401 and never exposes server exceptions', async () => {
    reply({ error: 'DPOP_PROOF_REQUIRED', detail: 'SQL private details' }, 401);
    await expect(request('/devices/list')).rejects.toMatchObject({ status: 401 });
    expect(window.dispatchEvent).toHaveBeenCalled();
    expect(friendlyError(new ApiError(401, 'SQL private details'))).not.toContain('SQL');
  });
  it('rejects malformed and duplicate evidence instead of showing false pass counts', () => {
    const report = { runId: 'run', timestamp: new Date().toISOString(), probes: [{ id: '1', name: 'Origin test', status: 'PASS' as const, detail: 'server result' }] };
    expect(validateAttackReport(report)).toBe(report);
    expect(() => validateAttackReport({ ...report, probes: [...report.probes, ...report.probes] })).toThrow();
    expect(() => validateAttackReport({ ...report, probes: [] })).toThrow();
  });
});

it('mock onboarding, login, and logout never call a real API or authenticator', async () => {
  vi.resetModules(); vi.stubEnv('MODE', 'mock');
  const preview = await import('./api');
  expect(preview.mockMode).toBe(true);
  const result = await preview.register('preview-user');
  expect(result.recoveryCodes).toHaveLength(8);
  expect(result.recoveryCodes.every(code => code.startsWith('DEMO-ONLY'))).toBe(true);
  expect((await preview.login('preview-user')).role).toBe('USER');
  await preview.logout();
  await expect(preview.register('preview-user')).rejects.toMatchObject({ status: 400 });
  await expect(preview.login('unknown')).rejects.toMatchObject({ status: 401 });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(startRegistration).not.toHaveBeenCalled();
  expect(startAuthentication).not.toHaveBeenCalled();
});
