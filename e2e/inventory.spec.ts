import { test, expect } from '@playwright/test';

const mockMeasures = [
  { measureId: 'ML', singular: 'millilitre', plural: 'millilitres' },
  { measureId: 'ITEMS', singular: 'item', plural: 'items' },
];

const mockInventoryItems = [
  {
    uuid: 'item-1',
    name: 'Milk',
    measure: { measureId: 'ML', singular: 'millilitre', plural: 'millilitres' },
    amount: 500,
    expiration: '2099-12-31',
    barcode: '5012345678900',
  },
];

test.describe('Inventory (auth disabled)', () => {
  test.beforeEach(async ({ page }) => {
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

  test('inventory page shows items and action buttons', async ({ page }) => {
    await page.goto('/inventory');
    await expect(page.getByText('Milk')).toBeVisible();
    await expect(page.getByRole('link', { name: /add to inventory/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /scan/i })).toBeVisible();
  });

  test('scan button links to scan page', async ({ page }) => {
    await page.goto('/inventory');
    await page.getByRole('link', { name: /scan/i }).click();
    await expect(page).toHaveURL('/inventory/scan');
    await expect(page.getByText('Scan barcode')).toBeVisible();
  });

  test('"add to inventory" opens the create form', async ({ page }) => {
    await page.goto('/inventory');
    await page.getByRole('link', { name: /add to inventory/i }).click();
    await expect(page).toHaveURL('/inventory/create');
    await expect(page.getByLabel('Name')).toBeVisible();
    await expect(page.getByLabel('Measure')).toBeVisible();
    await expect(page.getByLabel('Amount')).toBeVisible();
    await expect(page.getByLabel('Expiration date')).toBeVisible();
    await expect(page.getByLabel(/Barcode/)).toBeVisible();
  });

  test('create form submits and redirects to inventory', async ({ page }) => {
    const savedItem = { ...mockInventoryItems[0], uuid: 'item-new' };
    await page.route('/api/inventory', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, json: savedItem });
      } else {
        await route.fulfill({ json: mockInventoryItems });
      }
    });

    await page.goto('/inventory/create');
    await page.getByLabel('Name').fill('Milk');
    await page.getByLabel('Measure').selectOption({ label: 'millilitres' });
    await page.getByLabel('Amount').fill('500');
    await page.getByLabel('Expiration date').fill('2099-12-31');
    await page.getByRole('button', { name: /add to inventory/i }).click();

    await expect(page).toHaveURL('/inventory');
  });

  test('create form shows error on failed submission', async ({ page }) => {
    await page.route('/api/inventory', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 500 });
      } else {
        route.fulfill({ json: mockInventoryItems });
      }
    });

    await page.goto('/inventory/create');
    await page.getByLabel('Name').fill('Milk');
    await page.getByLabel('Amount').fill('500');
    await page.getByLabel('Expiration date').fill('2099-12-31');
    await page.getByRole('button', { name: /add to inventory/i }).click();

    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('clicking an inventory item opens its detail page', async ({ page }) => {
    await page.goto('/inventory');
    await page.getByText('Milk').click();
    await expect(page).toHaveURL(/\/inventory\/item-1/);
  });
});
