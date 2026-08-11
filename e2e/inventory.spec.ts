import { test, expect } from '@playwright/test';

const mockMeasures = [
  { measureId: 'ML', singular: 'millilitre', plural: 'millilitres', short: 'ml' },
  { measureId: 'ITEMS', singular: 'item', plural: 'items', short: 'item' },
];

// `measure` is the raw measureId string on the wire, not an expanded object —
// components needing the display name look it up via mockMeasures above.
const mockInventoryItems = [
  {
    uuid: 'item-1',
    name: 'Milk',
    measure: 'ML',
    amount: 500,
    expiration: '2099-12-31',
    barcode: '5012345678900',
  },
];

test.describe('Inventory (auth disabled)', () => {
  test.beforeEach(async ({ page }) => {
    // useActiveHouse() requires a real "authenticated" session and a resolved
    // house before any house-scoped fetch fires — fake both (see house-settings.spec.ts).
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({
        json: {
          user: { name: 'Owner', email: 'owner@example.com' },
          expires: '2099-01-01T00:00:00.000Z',
        },
      }),
    );
    await page.route('/api/houses', (route) =>
      route.fulfill({ json: [{ id: 'house-1', name: 'Home', role: 'OWNER' }] }),
    );
    // Intercept BFF API calls with stable test data
    await page.route('/api/inventory', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ json: mockInventoryItems });
      } else {
        route.continue();
      }
    });
    await page.route('/api/measures', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ json: mockMeasures });
      } else {
        route.continue();
      }
    });
  });

  test('inventory page shows items and the scan action', async ({ page }) => {
    await page.goto('/inventory');
    await expect(page.getByText('Milk')).toBeVisible();
    // The scan link is behind the "Add to inventory" FAB, not visible until opened.
    await page.getByRole('button', { name: 'Add to inventory' }).click();
    await expect(page.getByRole('link', { name: /add one item/i })).toBeVisible();
  });

  test('scan button links to scan page', async ({ page }) => {
    await page.goto('/inventory');
    await page.getByRole('button', { name: 'Add to inventory' }).click();
    await page.getByRole('link', { name: /add one item/i }).click();
    await expect(page).toHaveURL('/inventory/scan');
    await expect(page.getByText('Scan barcode')).toBeVisible();
  });

  test('clicking an inventory item opens its detail page', async ({ page }) => {
    await page.goto('/inventory');
    await page.getByText('Milk').click();
    await expect(page).toHaveURL(/\/inventory\/item-1/);
  });
});

test.describe('Binning the last of an item (auth disabled)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({
        json: {
          user: { name: 'Owner', email: 'owner@example.com' },
          expires: '2099-01-01T00:00:00.000Z',
        },
      }),
    );
    await page.route('/api/houses', (route) =>
      route.fulfill({ json: [{ id: 'house-1', name: 'Home', role: 'OWNER' }] }),
    );
    await page.route('/api/measures', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ json: mockMeasures });
      } else {
        route.continue();
      }
    });
  });

  test('binning it all removes the item from the pantry list rather than leaving a 0-remaining row', async ({ page }) => {
    // Mutable backing "database" so GET reflects whatever the PUT below did — mirrors the
    // real backend's archive-and-delete behavior (see InventoryService.saveOrArchive).
    let items = [...mockInventoryItems];

    await page.route('/api/inventory', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ json: items });
      } else {
        route.continue();
      }
    });
    await page.route('/api/inventory/item-1', (route) => {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON();
        if (body.remaining <= 0) {
          items = items.filter((item) => item.uuid !== 'item-1');
          route.fulfill({ status: 204 });
        } else {
          route.fulfill({ json: { ...items[0], remaining: body.remaining } });
        }
      } else {
        route.continue();
      }
    });

    await page.goto('/inventory');
    await expect(page.getByText('Milk')).toBeVisible();

    await page.getByRole('button', { name: 'Throw away Milk' }).click();
    await page.getByLabel('Amount thrown away').fill('500');
    await page.getByRole('button', { name: 'Throw away', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Throw away Milk' })).not.toBeVisible();
    await expect(page.getByText('No items in inventory')).toBeVisible();
    await expect(page.getByRole('link', { name: /Milk/ })).not.toBeVisible();
  });
});
