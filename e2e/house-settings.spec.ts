import { test, expect, Page } from '@playwright/test';

// NextAuth's useSession() fetches its own session from /api/auth/session rather
// than trusting NEXT_PUBLIC_AUTH_DISABLED (that env var only bypasses the
// middleware/AccessGate redirect — see proxy.ts/AccessGate.tsx). House data is
// gated on a real "authenticated" status, so these specs fake that endpoint too.
async function mockSession(page: Page) {
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      json: {
        user: { name: 'Owner', email: 'owner@example.com' },
        expires: '2099-01-01T00:00:00.000Z',
      },
    }),
  );
}

const houses = [
  { id: 'house-1', name: 'Bayview Gardens', role: 'OWNER' },
  { id: 'house-2', name: 'Test House', role: 'READ_ONLY' },
];

const members = [
  { userId: 'owner-1', email: 'owner@example.com', role: 'OWNER' },
  { userId: 'member-1', email: 'member@example.com', role: 'READ_ONLY' },
];

const pendingInvites = [
  { id: 'invite-1', code: 'abc123def456ghi789jk', role: 'READ_ONLY', createdAt: '2026-01-01T00:00:00.000Z' },
];

test.describe('House settings page', () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page);
    await page.route('/api/houses', (route) => route.fulfill({ json: houses }));
    await page.route('/api/houses/members', (route) => route.fulfill({ json: members }));
    await page.route('/api/houses/invites', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ json: pendingInvites });
      } else {
        route.continue();
      }
    });
  });

  test('shows the house switcher with all of the user\'s houses', async ({ page }) => {
    await page.goto('/settings/house');
    const switcher = page.getByLabel('Active house');
    await expect(switcher).toBeVisible();
    await expect(switcher.locator('option')).toHaveText(['Bayview Gardens', 'Test House']);
  });

  test('lists members and their roles for the active (owned) house', async ({ page }) => {
    await page.goto('/settings/house');
    const main = page.getByRole('main');
    await expect(main.getByText('owner@example.com')).toBeVisible();
    await expect(main.getByText('member@example.com')).toBeVisible();
  });

  test('shows the pending invite code, truncated', async ({ page }) => {
    await page.goto('/settings/house');
    await expect(page.getByText('abc123def456ghi789jk')).toBeVisible();
  });

  test('generates an invite and copies the link to the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.route('/api/houses/invites', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          json: { id: 'invite-2', code: 'newcode123', role: 'READ_ONLY', createdAt: '2026-01-02T00:00:00.000Z' },
        });
      } else {
        await route.fulfill({ json: pendingInvites });
      }
    });

    await page.goto('/settings/house');
    await page.getByRole('button', { name: 'Generate invite' }).click();

    await expect(page.getByText('Link copied!')).toBeVisible();
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('/invite/newcode123');
  });

  test('deletes a pending invite', async ({ page }) => {
    let deleteRequested = false;
    await page.route('/api/houses/invites/invite-1', async (route) => {
      deleteRequested = true;
      await route.fulfill({ status: 204 });
    });

    await page.goto('/settings/house');
    await page.getByRole('button', { name: 'Delete' }).click();

    await expect.poll(() => deleteRequested).toBe(true);
  });

  test('shows an owners-only message when the active house is read-only', async ({ page, baseURL }) => {
    // addCookies needs an existing page context with a URL — navigate first,
    // set the cookie, then reload so it takes effect on the next request.
    await page.context().addCookies([
      { name: 'reciplease-house-id', value: 'house-2', url: baseURL ?? 'http://localhost:3000' },
    ]);
    await page.goto('/settings/house');

    await expect(page.getByText(/Only owners of Test House/)).toBeVisible();
    // The switcher is still available even when the user can't manage this house.
    await expect(page.getByLabel('Active house')).toBeVisible();
  });
});

test.describe('Invite landing page', () => {
  test('shows the house name and a sign-in prompt when unauthenticated', async ({ page }) => {
    await page.route('**/api/auth/session', (route) => route.fulfill({ json: {} }));
    await page.route('/api/invites/abc123', (route) =>
      route.fulfill({ json: { houseId: 'house-1', houseName: 'Test House' } }),
    );

    await page.goto('/invite/abc123');

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: /invited to Test House/ })).toBeVisible();
    await expect(main.getByRole('button', { name: /sign in with google/i })).toBeVisible();
  });

  test('shows an invalid-invite message for an unknown code', async ({ page }) => {
    await page.route('**/api/auth/session', (route) => route.fulfill({ json: {} }));
    await page.route('/api/invites/does-not-exist', (route) => route.fulfill({ status: 404 }));

    await page.goto('/invite/does-not-exist');

    await expect(page.getByText(/invalid or has already been used/i)).toBeVisible();
  });
});
