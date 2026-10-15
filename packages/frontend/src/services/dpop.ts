// Evaluation-2 contract uses a path-only htu, not the absolute URI used by OAuth RFC 9449.
const databaseName = 'trustx-device-keys';
let activeKey: Promise<CryptoKeyPair> | undefined;

async function storeKey(value?: CryptoKeyPair): Promise<CryptoKeyPair | undefined> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('keys');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Device key storage is blocked'));
  });
  database.onversionchange = () => database.close();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction('keys', value ? 'readwrite' : 'readonly');
      const request = value ? transaction.objectStore('keys').put(value, 'session') : transaction.objectStore('keys').get('session');
      transaction.oncomplete = () => resolve(value ?? request.result);
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { database.close(); }
}

function getKey(): Promise<CryptoKeyPair> {
  async function load() {
    const stored = await storeKey();
    if (stored) {
      if (stored.privateKey.extractable || stored.privateKey.algorithm.name !== 'ECDSA') throw new Error('Invalid stored device key');
      return stored;
    }
    const generated = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
    await storeKey(generated);
    return generated;
  }
  activeKey ??= (async () => navigator.locks ? await navigator.locks.request('trustx-device-key', load) : await load())().catch(error => { activeKey = undefined; throw error; });
  return activeKey;
}

export async function publicDeviceKey(): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', (await getKey()).publicKey);
}

export async function clearDeviceKey(): Promise<void> {
  activeKey = undefined;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other TrustX tabs to clear the device key'));
  });
}

export function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export async function createProof(method: string, path: string): Promise<string> {
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) throw new Error('Invalid proof target');
  const key = await getKey();
  const jwk = await crypto.subtle.exportKey('jwk', key.publicKey);
  const encode = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)));
  const header = encode({ typ: 'dpop+jwt', alg: 'ES256', jwk });
  const payload = encode({ htm: method.toUpperCase(), htu: url.pathname, iat: Math.floor(Date.now() / 1000), jti: crypto.randomUUID() });
  const input = `${header}.${payload}`;
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key.privateKey, new TextEncoder().encode(input));
  return `${input}.${base64url(new Uint8Array(signature))}`;
}
