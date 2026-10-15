import { expect, test } from '@playwright/test';

test('real backend verifies a browser-generated passkey and receives the DPoP binding key', async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  await page.goto('/');
  await expect(page.getByText('Session restoration is unavailable. Sign in to continue.')).toBeVisible();
  await page.getByRole('button', { name: 'Create account', exact: true }).first().click();
  await page.getByLabel('Username', { exact: true }).fill('live-browser-user');
  await page.getByRole('button', { name: 'Create account', exact: true }).last().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').locator('code')).toHaveCount(8);
  expect(await page.getByRole('dialog').locator('code').allTextContents()).not.toContain('DEMO-ONLY-0001');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue to sign in' }).click();
  await page.getByLabel('Username', { exact: true }).fill('live-browser-user');
  const verification = page.waitForRequest(request => request.url().endsWith('/api/auth/login-verify'));
  const inventory = page.waitForRequest(request => request.url().endsWith('/api/devices/list'));
  await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
  expect((await verification).postDataJSON().dpopPublicKey).toMatchObject({ kty: 'EC', crv: 'P-256' });
  await expect(page.getByRole('heading', { name: 'Hello, live-browser-user' })).toBeVisible();
  expect((await inventory).headers().dpop.split('.')).toHaveLength(3);
  await expect(page.getByRole('alert')).toContainText('not available');
  expect((await context.cookies()).some(cookie => cookie.name === 'session_id' && cookie.httpOnly && cookie.secure && cookie.sameSite === 'Strict')).toBe(true);
});
