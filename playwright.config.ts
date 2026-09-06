import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests run against a local Next.js dev server with:
 *   - NEXT_PUBLIC_AUTH_DISABLED=true  — bypasses Google sign-in gate
 *   - BACKEND_URL pointing at production — serves real recipe/inventory data
 *
 * Run: npx playwright test
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 1,
  reporter: 'list',

  // Dev-mode Turbopack compiles each route on first hit; under fullyParallel
  // load, many workers can be triggering first-hit compiles at once, and a
  // fresh dynamic route (e.g. /pantry/[uuid]) can take longer than the
  // default 5s to become ready — bump the assertion timeout so navigation
  // checks don't flake on that contention, and allow one retry locally too
  // (CI already did, via `retries` above) for whatever contention remains.
  expect: {
    timeout: 15_000,
  },

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    env: {
      BACKEND_URL: 'https://app.reciplease.org',
      NEXT_PUBLIC_AUTH_DISABLED: 'true',
      // Required by next-auth even when auth is disabled
      NEXTAUTH_SECRET: 'playwright-local-secret',
      NEXTAUTH_URL: 'http://localhost:3000',
      GOOGLE_CLIENT_ID: 'not-used',
      GOOGLE_CLIENT_SECRET: 'not-used',
    },
  },
});
