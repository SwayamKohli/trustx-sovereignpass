import { expect, test } from '@playwright/test';

test('guided access is bilingual, offers a no-phone key path, and reads only static instructions with local voices',async({page})=>{
  await page.addInitScript(()=>{
    const spoken:{text:string;local:boolean}[]=[];
    Object.defineProperty(window,'__spoken',{value:spoken});
    class Utterance {text:string;voice?:SpeechSynthesisVoice;onend?:()=>void;constructor(text:string){this.text=text;}}
    Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:Utterance});
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[{lang:'en-IN',name:'Local English',localService:true},{lang:'hi-IN',name:'Remote Hindi',localService:false}],addEventListener(){},removeEventListener(){},cancel(){},speak(u:Utterance){spoken.push({text:u.text,local:!!u.voice?.localService});setTimeout(()=>u.onend?.(),0);}}});
  });
  await page.goto('/access');
  await expect(page.getByRole('heading',{name:'I have no smartphone',exact:true})).toBeVisible();
  await page.getByText('Listen to instructions',{exact:true}).click();
  await page.getByRole('button',{name:'Read aloud',exact:true}).click();
  const spoken=await page.evaluate(()=>(window as unknown as {__spoken:{text:string;local:boolean}[]}).__spoken);
  expect(spoken).toHaveLength(1);expect(spoken[0].local).toBe(true);expect(spoken[0].text).toContain('storage USB drive will not work');
  await page.getByRole('button',{name:'Switch to Hindi'}).click();
  await expect(page.getByRole('heading',{name:'अपने लिए सही तरीका चुनें'})).toBeVisible();
  await expect(page.getByText('इस ब्राउज़र में इस भाषा की ऑफलाइन आवाज़ उपलब्ध नहीं है।',{exact:false})).toBeVisible();
  expect(await page.getByRole('button',{name:'सुनाएँ',exact:true}).count()).toBe(0);
  await page.getByRole('button',{name:'सुरक्षा कुंजी पंजीकृत करें',exact:true}).click();
  await expect(page.getByLabel('पासकी का तरीका')).toHaveValue('security-key');
  await page.getByLabel('उपयोगकर्ता नाम',{exact:true}).fill('hindi-preview');
  await page.getByRole('button',{name:'खाता बनाएँ',exact:true}).last().click();
  await expect(page.getByRole('dialog')).toContainText('अपने आपातकालीन कोड सुरक्षित रखें');
  await expect(page.getByRole('dialog').locator('code')).toHaveCount(8);
  await expect(page.getByRole('button',{name:'साइन इन की ओर बढ़ें'})).toBeDisabled();
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'साइन इन की ओर बढ़ें'}).click();
  await page.getByRole('button',{name:'खाता पुनर्प्राप्ति',exact:true}).click();
  await expect(page.getByLabel('आपातकालीन रिकवरी कोड')).toBeVisible();
  await page.getByText('रिकवरी कोड नहीं है?',{exact:true}).click();
  await expect(page.getByText('सभी पासकी और कोड खोने पर ऐप सुरक्षित रीसेट नहीं कर सकता।',{exact:false})).toBeVisible();
});

test('onboarding, saved-code gate, login, add/revoke device and sign out', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create account', exact: true }).first().click();
  await page.getByLabel('Username', { exact: true }).fill('ananya');
  await page.getByRole('button', { name: 'Create account', exact: true }).last().click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByRole('heading', { name: 'Save your emergency codes' })).toBeVisible();
  await expect(modal.locator('code')).toHaveCount(8);
  await expect(modal.getByRole('button', { name: 'Continue to sign in' })).toBeDisabled();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.querySelector('dialog')?.contains(document.activeElement))).toBe(true);
  const download = page.waitForEvent('download');
  await modal.getByRole('button', { name: 'Download codes' }).click();
  expect((await download).suggestedFilename()).toBe('trustx-recovery-codes.txt');
  await modal.getByRole('checkbox').check();
  await modal.getByRole('button', { name: 'Continue to sign in' }).click();
  await page.getByLabel('Username', { exact: true }).fill('ananya');
  await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
  await expect(page.getByRole('heading', { name: 'Hello, ananya' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Admin SOC' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add a passkey' }).click();
  await page.getByLabel('Device name').fill('Backup key');
  await page.getByRole('button', { name: 'Enroll passkey', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Revoke Backup key' })).toBeVisible();
  await page.getByRole('button', { name: 'Revoke Backup key' }).click();
  await page.getByRole('button', { name: 'Confirm revocation' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Backup key' })).toContainText('REVOKED');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in securely' })).toBeVisible();
});

test('mobile layout fits the viewport and dialog keyboard focus remains contained', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Use a shared terminal' }).click();
  await expect(page.getByRole('dialog').getByRole('img')).toBeVisible();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.querySelector('dialog')?.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true });
});

test('two-phase recovery can be cancelled without consuming the code, then completed once', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Recover account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill('demo');
  await page.getByLabel('Emergency recovery code').fill('DEMO-ONLY-0001');
  await page.getByRole('button', { name: 'Verify emergency code' }).click();
  await expect(page.getByRole('dialog')).toContainText('is not consumed yet');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await page.getByLabel('Emergency recovery code').fill('DEMO-ONLY-0001');
  await page.getByRole('button', { name: 'Verify emergency code' }).click();
  await page.getByRole('button', { name: 'Enroll replacement passkey' }).click();
  await expect(page.getByRole('heading', { name: 'Your replacement passkey is ready' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in with your replacement passkey' }).click();
  await page.getByRole('button', { name: 'Recover account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill('demo');
  await page.getByLabel('Emergency recovery code').fill('DEMO-ONLY-0001');
  await page.getByRole('button', { name: 'Verify emergency code' }).click();
  await expect(page.getByRole('alert')).toContainText('already used');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('kiosk preview claims an ephemeral session and exposes no terminal secret in the URL', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Use a shared terminal' }).click();
  await expect(page.getByRole('dialog').getByRole('img')).toBeVisible();
  expect(page.url()).not.toContain('kioskClientSecret');
  await page.getByRole('button', { name: 'Simulate phone approval' }).click();
  await expect(page.getByRole('heading', { name: 'Hello, demo' })).toBeVisible({ timeout: 6000 });
  await expect(page.getByText(/Public terminal ·/)).toContainText('minutes remaining');
  await expect(page.getByRole('button', { name: 'Add a passkey' })).toHaveCount(0);
});

test('SOC shows skipped preview probes and never fabricates a verified chain', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByLabel('Username', { exact: true }).fill('demo-admin');
  await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
  await page.getByRole('button', { name: 'Admin SOC', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sessions, incidents & evidence' })).toBeVisible();
  await expect(page.locator('.report-counts')).toContainText('PASS: 0');
  await expect(page.locator('.report-counts')).toContainText('SKIPPED: 8');
  await page.getByRole('button', { name: 'Execute live attack runner' }).click();
  await expect(page.getByText('Preview report loaded. All probes skipped; no tests ran.')).toBeVisible();
  await page.getByRole('button', { name: 'Verify chain on server' }).click();
  await expect(page.getByRole('alert').first()).toContainText('not available');
  await expect(page.getByText('Unverified. No integrity claim', { exact: false })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('soc.png'), fullPage: true });
});

test('DPoP key is non-extractable, signs correctly, survives reload and rotates after cleanup', async ({ page }) => {
  await page.goto('/');
  const first = await page.evaluate(async () => {
    const module = await import('/src/services/dpop.ts');
    const jwk = await module.publicDeviceKey();
    const firstProof = await module.createProof('post', '/api/devices/revoke');
    const secondProof = await module.createProof('POST', '/api/devices/revoke');
    const parts = firstProof.split('.');
    const decode = (part: string) => Uint8Array.from(atob(part.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0));
    const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    const payload = JSON.parse(new TextDecoder().decode(decode(parts[1])));
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, decode(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    const tampered = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, decode(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}modified`));
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('trustx-device-keys', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const stored = await new Promise<CryptoKeyPair>((resolve, reject) => { const request = database.transaction('keys').objectStore('keys').get('session'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    database.close();
    let privateExportBlocked = false;
    try { await crypto.subtle.exportKey('jwk', stored.privateKey); } catch { privateExportBlocked = true; }
    let crossOriginBlocked = false;
    try { await module.createProof('GET', 'https://attacker.example/api/devices/list'); } catch { crossOriginBlocked = true; }
    return { jwk, valid, tampered, payload, header, distinct: firstProof !== secondProof, privateExportBlocked, crossOriginBlocked };
  });
  expect(first).toMatchObject({ valid: true, tampered: false, distinct: true, privateExportBlocked: true, crossOriginBlocked: true, payload: { htm: 'POST', htu: '/api/devices/revoke' }, header: { alg: 'ES256', typ: 'dpop+jwt' } });
  expect(first.payload.iat).toBeGreaterThan(Math.floor(Date.now() / 1000) - 60);
  await page.reload();
  expect(await page.evaluate(async () => (await import('/src/services/dpop.ts')).publicDeviceKey())).toEqual(first.jwk);
  const next = await page.evaluate(async () => { const module = await import('/src/services/dpop.ts'); await module.clearDeviceKey(); return module.publicDeviceKey(); });
  expect(next).not.toEqual(first.jwk);
});
