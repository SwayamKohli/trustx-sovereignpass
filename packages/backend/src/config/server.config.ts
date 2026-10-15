// Server, Port & Reverse-Proxy Configuration
// Owner: Swayam (Role 4 — Systems Integration, Risk Engine & AI/Crypto Lead)

import path from 'path';
import fs from 'fs';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';

export interface ServerConfig {
  port: number;
  vitePort: number;
  rpName: string;
  rpId: string;
  expectedOrigin: string;
  fakePhishingOrigin: string;
  certPaths: {
    cert: string;
    key: string;
  };
}

// Find repository root by searching upward for package.json with workspaces
function findRepoRoot(startDir: string): string {
  let current = startDir;
  while (current !== path.dirname(current)) {
    const pkgPath = path.join(current, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.workspaces) return current;
      } catch {
        // continue walking up
      }
    }
    current = path.dirname(current);
  }
  return path.resolve(startDir, '../../..');
}

const REPO_ROOT = findRepoRoot(__dirname);

export const serverConfig: ServerConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  vitePort: parseInt(process.env.VITE_PORT || '5173', 10),
  rpName: process.env.RP_NAME || 'TrustX SovereignPass',
  rpId: process.env.RP_ID || 'bank.local',
  expectedOrigin: process.env.EXPECTED_ORIGIN || 'https://bank.local:3000',
  fakePhishingOrigin: process.env.FAKE_PHISHING_ORIGIN || 'https://b4nk-secure.local:3001',
  certPaths: {
    cert: path.resolve(REPO_ROOT, 'certs', 'cert.pem'),
    key: path.resolve(REPO_ROOT, 'certs', 'key.pem'),
  },
};

/**
 * Loads SSL certificates for HTTPS termination.
 * Returns null if certificates are not yet generated via mkcert.
 */
export function loadSslCertificates(): { cert: Buffer; key: Buffer } | null {
  if (process.env.LOCAL_HTTP === '1') return null;
  const { cert: certPath, key: keyPath } = serverConfig.certPaths;
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    return {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    };
  }
  return null;
}

export function demoOrigins() {
  const secure = !!loadSslCertificates();
  return {
    bankOrigin: secure ? serverConfig.expectedOrigin : `http://localhost:${serverConfig.port}`,
    attackerOrigin: secure ? serverConfig.fakePhishingOrigin : `http://127.0.0.1:${process.env.PHISH_PORT || '3001'}`,
    rpId: secure ? serverConfig.rpId : 'localhost',
    mode: secure ? 'https' : 'local-http',
  };
}

/**
 * Creates reverse-proxy middleware that proxies non-API traffic to the internal Vite dev server.
 * Supports WebSocket upgrades for Vite Hot Module Replacement (HMR).
 */
export function createViteReverseProxy() {
  const proxyOptions: Options = {
    target: `http://127.0.0.1:${serverConfig.vitePort}`,
    changeOrigin: false,
    ws: true, // Enable WebSocket proxying for Vite HMR
    logger: console,
  };
  return createProxyMiddleware(proxyOptions);
}
