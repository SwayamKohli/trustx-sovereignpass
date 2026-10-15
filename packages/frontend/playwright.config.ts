import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:5174', headless: true, trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev:mock -- --force --port 5174', url: 'http://127.0.0.1:5174', reuseExistingServer: false },
});
