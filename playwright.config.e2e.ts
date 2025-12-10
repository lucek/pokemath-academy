import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.e2e' });

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  use: {
    baseURL: process.env.ASTRO_SITE || 'http://localhost:4173',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    // @astrojs/vercel does not support `astro preview`, so run the dev server in
    // e2e mode instead.
    command: 'npm run dev -- --host 0.0.0.0 --port 4173 --mode e2e',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
