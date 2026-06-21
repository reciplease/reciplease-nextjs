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

  test('inventory page shows items and the scan action', async ({ page }) => {
    await page.goto('/inventory');
    await expect(page.getByText('Milk')).toBeVisible();
    await expect(page.getByRole('link', { name: /scan/i })).toBeVisible();
  });

  test('scan button links to scan page', async ({ page }) => {
    await page.goto('/inventory');
    await page.getByRole('link', { name: /scan/i }).click();
    await expect(page).toHaveURL('/inventory/scan');
    await expect(page.getByText('Scan barcode')).toBeVisible();
  });

  test('clicking an inventory item opens its detail page', async ({ page }) => {
    await page.goto('/inventory');
    await page.getByText('Milk').click();
    await expect(page).toHaveURL(/\/inventory\/item-1/);
  });
});
