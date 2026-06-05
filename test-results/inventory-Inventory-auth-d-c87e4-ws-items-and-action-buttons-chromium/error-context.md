# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: inventory.spec.ts >> Inventory (auth disabled) >> inventory page shows items and action buttons
- Location: e2e\inventory.spec.ts:45:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Milk')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Milk')

```

```yaml
- navigation:
  - button "previous" [disabled]:
    - img "previous"
  - text: 1/1
  - button "next" [disabled]:
    - img "next"
- img
- img
- text: Next.js 16.2.7 Turbopack
- img
- dialog "Build Error":
  - text: Build Error
  - button "Copy Error Info":
    - img
  - link "Go to related documentation":
    - /url: https://nextjs.org/docs/messages/module-not-found
    - img
  - button "Attach Node.js inspector":
    - img
  - text: "Module not found: Can't resolve './Inventory.module.scss'"
  - img
  - text: ./src/pages/inventory/create.tsx (5:1)
  - button "Open in editor":
    - img
  - text: "Module not found: Can't resolve './Inventory.module.scss' 3 | import useSWR from 'swr'; 4 | import Metadata from '@/components/Metadata'; > 5 | import styles from './Inventory.module.scss'; | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 6 | 7 | const fetcher = (url: string): Promise<Ingredient[]> => 8 | fetch(url).then((res) => res.json());"
  - link "https://nextjs.org/docs/messages/module-not-found":
    - /url: https://nextjs.org/docs/messages/module-not-found
- button "Open Next.js Dev Tools":
  - img
- button "Open issues overlay": 1 Issue
- alert
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | const mockIngredients = [
  4   |   { uuid: 'ing-1', name: 'Milk', measure: { measureId: 'ML', singular: 'millilitre', plural: 'millilitres' } },
  5   |   { uuid: 'ing-2', name: 'Bread', measure: { measureId: 'ITEMS', singular: 'item', plural: 'items' } },
  6   | ];
  7   | 
  8   | const mockMeasures = [
  9   |   { measureId: 'ML', singular: 'millilitre', plural: 'millilitres' },
  10  |   { measureId: 'ITEMS', singular: 'item', plural: 'items' },
  11  | ];
  12  | 
  13  | const mockInventoryItems = [
  14  |   {
  15  |     uuid: 'item-1',
  16  |     ingredientUuid: 'ing-1',
  17  |     name: 'Milk',
  18  |     measure: { measureId: 'ML', singular: 'millilitre', plural: 'millilitres' },
  19  |     amount: 500,
  20  |     expiration: '2099-12-31',
  21  |   },
  22  | ];
  23  | 
  24  | test.describe('Inventory (auth disabled)', () => {
  25  |   test.beforeEach(async ({ page }) => {
  26  |     // Intercept BFF API calls with stable test data
  27  |     await page.route('/api/inventory', (route) => {
  28  |       if (route.request().method() === 'GET') {
  29  |         route.fulfill({ json: mockInventoryItems });
  30  |       } else {
  31  |         route.continue();
  32  |       }
  33  |     });
  34  |     await page.route('/api/ingredients', (route) => route.fulfill({ json: mockIngredients }));
  35  |     await page.route('/api/ingredients/search**', (route) => route.fulfill({ json: mockIngredients }));
  36  |     await page.route('/api/measures', (route) => {
  37  |       if (route.request().method() === 'GET') {
  38  |         route.fulfill({ json: mockMeasures });
  39  |       } else {
  40  |         route.continue();
  41  |       }
  42  |     });
  43  |   });
  44  | 
  45  |   test('inventory page shows items and action buttons', async ({ page }) => {
  46  |     await page.goto('/inventory');
> 47  |     await expect(page.getByText('Milk')).toBeVisible();
      |                                          ^ Error: expect(locator).toBeVisible() failed
  48  |     await expect(page.getByRole('link', { name: /add to inventory/i })).toBeVisible();
  49  |     await expect(page.getByRole('link', { name: /scan/i })).toBeVisible();
  50  |   });
  51  | 
  52  |   test('scan button links to scan page', async ({ page }) => {
  53  |     await page.goto('/inventory');
  54  |     await page.getByRole('link', { name: /scan/i }).click();
  55  |     await expect(page).toHaveURL('/inventory/scan');
  56  |     await expect(page.getByText('Scan barcode')).toBeVisible();
  57  |   });
  58  | 
  59  |   test('"add to inventory" opens the create form', async ({ page }) => {
  60  |     await page.goto('/inventory');
  61  |     await page.getByRole('link', { name: /add to inventory/i }).click();
  62  |     await expect(page).toHaveURL('/inventory/create');
  63  |     await expect(page.getByLabel('Ingredient')).toBeVisible();
  64  |     await expect(page.getByLabel('Amount')).toBeVisible();
  65  |     await expect(page.getByLabel('Expiration date')).toBeVisible();
  66  |   });
  67  | 
  68  |   test('create form submits and redirects to inventory', async ({ page }) => {
  69  |     const savedItem = { ...mockInventoryItems[0], uuid: 'item-new' };
  70  |     await page.route('/api/inventory', async (route) => {
  71  |       if (route.request().method() === 'POST') {
  72  |         await route.fulfill({ status: 201, json: savedItem });
  73  |       } else {
  74  |         await route.fulfill({ json: mockInventoryItems });
  75  |       }
  76  |     });
  77  | 
  78  |     await page.goto('/inventory/create');
  79  |     await page.getByLabel('Ingredient').selectOption({ label: 'Milk' });
  80  |     await page.getByLabel('Amount').fill('500');
  81  |     await page.getByLabel('Expiration date').fill('2099-12-31');
  82  |     await page.getByRole('button', { name: /add to inventory/i }).click();
  83  | 
  84  |     await expect(page).toHaveURL('/inventory');
  85  |   });
  86  | 
  87  |   test('create form shows error on failed submission', async ({ page }) => {
  88  |     await page.route('/api/inventory', (route) => {
  89  |       if (route.request().method() === 'POST') {
  90  |         route.fulfill({ status: 500 });
  91  |       } else {
  92  |         route.fulfill({ json: mockInventoryItems });
  93  |       }
  94  |     });
  95  | 
  96  |     await page.goto('/inventory/create');
  97  |     await page.getByLabel('Ingredient').selectOption({ label: 'Milk' });
  98  |     await page.getByLabel('Amount').fill('500');
  99  |     await page.getByLabel('Expiration date').fill('2099-12-31');
  100 |     await page.getByRole('button', { name: /add to inventory/i }).click();
  101 | 
  102 |     await expect(page.getByRole('alert')).toBeVisible();
  103 |   });
  104 | 
  105 |   test('clicking an inventory item opens its detail page', async ({ page }) => {
  106 |     await page.goto('/inventory');
  107 |     await page.getByText('Milk').click();
  108 |     await expect(page).toHaveURL(/\/inventory\/item-1/);
  109 |   });
  110 | });
  111 | 
```