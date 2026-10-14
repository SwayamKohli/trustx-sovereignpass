import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@simplewebauthn/browser', () => ({ startRegistration: vi.fn(), startAuthentication: vi.fn(), browserSupportsWebAuthn: () => true }));
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { ApiError, friendlyError, login, logout, register, request } from './api';

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('window', { isSecureContext: true });
});
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function reply(body: unknown, status = 200) { fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status })); }

describe('real passkey contracts', () => {
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
    await expect(logout()).rejects.toThrow('Invalid logout response');
  });
  it('rejects non-JSON responses and maps rate limits to readable messages', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>proxy missing</html>'));
    await expect(request('/devices/list')).rejects.toThrow();
    expect(friendlyError(new ApiError(429))).toContain('wait');
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
