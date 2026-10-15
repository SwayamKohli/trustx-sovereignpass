import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const databasePath = path.join(mkdtempSync(path.join(tmpdir(), 'trustx-e2e-')), 'bank.sqlite');
export default defineConfig({
  testDir: './e2e-live',
  outputDir: './test-results-live',
  workers: 1,
  timeout: 60_000,
  metadata: { databasePath },
  globalTeardown: './e2e-live/cleanup.ts',
  use: { baseURL: 'http://localhost:3002', headless: true, trace: 'retain-on-failure' },
  webServer: [
    { command: 'npm run dev -- --force --port 5175', url: 'http://127.0.0.1:5175', reuseExistingServer: false },
    { command: 'npm run dev --prefix ../backend', url: 'http://localhost:3002/api/health', reuseExistingServer: false, env: { PORT: '3002', PHISH_PORT: '3003', VITE_PORT: '5175', RP_ID: 'localhost', ORIGIN: 'http://localhost:3002', EXPECTED_ORIGIN: 'http://localhost:3002', LOCAL_HTTP: '1', DB_PATH: databasePath } },
    { command: 'npm run dev:phishing --prefix ../backend', url: 'http://127.0.0.1:3003/api/phish/health', reuseExistingServer: false, env: { PORT: '3002', PHISH_PORT: '3003', VITE_PORT: '5175', LOCAL_HTTP: '1', DB_PATH: databasePath } },
  ],
});
