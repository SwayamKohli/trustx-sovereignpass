import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e-live',
  workers: 1,
  use: { baseURL: 'http://localhost:3002', headless: true, trace: 'retain-on-failure' },
  webServer: [
    { command: 'npm run dev -- --port 5175', url: 'http://127.0.0.1:5175', reuseExistingServer: false },
    { command: 'npm run dev --prefix ../backend', url: 'http://localhost:3002/api/health', reuseExistingServer: false, env: { PORT: '3002', VITE_PORT: '5175', RP_ID: 'localhost', ORIGIN: 'http://localhost:3002', EXPECTED_ORIGIN: 'http://localhost:3002', DB_PATH: ':memory:' } },
  ],
});
