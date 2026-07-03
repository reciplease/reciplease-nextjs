import { test, expect, Page } from '@playwright/test';

// NextAuth's useSession() fetches its own session rather than trusting
// NEXT_PUBLIC_AUTH_DISABLED (see house-settings.spec.ts) — fake it so
// useGoogleHealthConnection()/useActiveHouse() have an "authenticated" status.
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

const mockMeasures = [{ measureId: 'ITEMS', singular: 'item', plural: 'items', short: 'item' }];

const inventoryItem = {
  uuid: 'item-1',
  name: 'Bananas',
  measure: 'ITEMS',
  amount: 6,
  remaining: 6,
  expiration: '2099-12-31',
};

test.describe('Google Health linking (settings page)', () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page);
    await page.route('/api/houses', (route) => route.fulfill({ json: [{ id: 'house-1', name: 'Home', role: 'OWNER' }] }));
  });

  test('shows a Link Google Health action when not connected', async ({ page }) => {
    await page.route('/api/google-health/connection', (route) => route.fulfill({ json: { connected: false } }));

    await page.goto('/settings');

    const section = page.getByRole('group', { name: 'Google Health' });
    await expect(section.getByRole('link', { name: 'Link Google Health' })).toBeVisible();
    await expect(section.getByText('Connected')).not.toBeVisible();
  });

  test('shows Connected + Disconnect when linked, and disconnects on click', async ({ page }) => {
    let connected = true;
    await page.route('/api/google-health/connection', (route) => {
      if (route.request().method() === 'DELETE') {
        connected = false;
        route.fulfill({ status: 204 });
      } else {
        route.fulfill({ json: { connected } });
      }
    });

    await page.goto('/settings');

    const section = page.getByRole('group', { name: 'Google Health' });
    await expect(section.getByText('Connected')).toBeVisible();

    await section.getByRole('button', { name: 'Disconnect' }).click();

    await expect(section.getByRole('link', { name: 'Link Google Health' })).toBeVisible();
  });

  test('shows an error banner when redirected back with ?googleHealth=error', async ({ page }) => {
    await page.route('/api/google-health/connection', (route) => route.fulfill({ json: { connected: false } }));

    await page.goto('/settings?googleHealth=error');

    await expect(page.getByRole('alert').filter({ hasText: 'Could not connect Google Health' })).toBeVisible();
  });
});

test.describe('Logging an inventory item as eaten', () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page);
    await page.route('/api/houses', (route) => route.fulfill({ json: [{ id: 'house-1', name: 'Home', role: 'OWNER' }] }));
    await page.route('/api/measures', (route) => route.fulfill({ json: mockMeasures }));
    await page.route('/api/inventory/item-1', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ json: inventoryItem });
      } else {
        route.continue();
      }
    });
  });

  test('the item detail page shows only the log-eaten FAB, not the section-wide scan FAB', async ({ page }) => {
    await page.route('/api/google-health/connection', (route) => route.fulfill({ json: { connected: false } }));

    await page.goto('/inventory/item-1');

    await expect(page.getByRole('button', { name: 'Log eaten' })).toBeVisible();
    await expect(page.getByRole('link', { name: /scan/i })).not.toBeVisible();
  });

  test('without a Google Health link, submitting an amount just decrements remaining', async ({ page }) => {
    await page.route('/api/google-health/connection', (route) => route.fulfill({ json: { connected: false } }));

    // A second page.route() on the same URL shadows the beforeEach one — its
    // own route.continue() would hit the real network instead of falling back
    // to the earlier handler — so this one covers both GET and PUT itself.
    let putBody: unknown;
    await page.route('/api/inventory/item-1', (route) => {
      if (route.request().method() === 'PUT') {
        putBody = route.request().postDataJSON();
        route.fulfill({ json: { ...inventoryItem, remaining: 4 } });
      } else {
        route.fulfill({ json: inventoryItem });
      }
    });

    await page.goto('/inventory/item-1');
    await page.getByRole('button', { name: 'Log eaten' }).click();

    // No Google Health match step when not linked.
    await expect(page.getByLabel('Match to a Google Health food (optional)')).not.toBeVisible();

    await page.getByLabel('Amount eaten').fill('2');
    // The "Log eaten" FAB is always in the DOM, panel open or not, so waiting
    // on it wouldn't actually wait for the submission — wait for the panel
    // itself (its heading) to unmount instead.
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { name: 'Log Bananas eaten' })).not.toBeVisible();

    expect(putBody).toMatchObject({ remaining: 4 });
  });

  test('with Google Health linked, matching a food logs it alongside the inventory update', async ({ page }) => {
    await page.route('/api/google-health/connection', (route) => route.fulfill({ json: { connected: true } }));
    await page.route('**/api/google-health/foods/search**', (route) =>
      route.fulfill({ json: [{ foodId: 'food-1', displayName: 'Banana, raw' }] }),
    );

    let logBody: unknown;
    await page.route('/api/google-health/foods/log', (route) => {
      logBody = route.request().postDataJSON();
      route.fulfill({ status: 200 });
    });
    await page.route('/api/inventory/item-1', (route) => {
      if (route.request().method() === 'PUT') {
        route.fulfill({ json: { ...inventoryItem, remaining: 5 } });
      } else {
        route.fulfill({ json: inventoryItem });
      }
    });

    await page.goto('/inventory/item-1');
    await page.getByRole('button', { name: 'Log eaten' }).click();

    await page.getByLabel('Amount eaten').fill('1');

    const search = page.getByLabel('Match to a Google Health food (optional)');
    await expect(search).toBeVisible();
    await search.fill('banana');
    await page.getByRole('button', { name: /Banana, raw/ }).click();

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { name: 'Log Bananas eaten' })).not.toBeVisible();

    expect(logBody).toMatchObject({ foodId: 'food-1', foodDisplayName: 'Banana, raw', amount: 1 });
  });
});
