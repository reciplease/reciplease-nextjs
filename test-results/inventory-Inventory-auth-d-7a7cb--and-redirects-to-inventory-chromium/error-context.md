# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: inventory.spec.ts >> Inventory (auth disabled) >> create form submits and redirects to inventory
- Location: e2e\inventory.spec.ts:68:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.selectOption: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByLabel('Ingredient')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [active]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]:
          - navigation [ref=e7]:
            - button "previous" [disabled] [ref=e8]:
              - img "previous" [ref=e9]
            - generic [ref=e11]:
              - generic [ref=e12]: 1/
              - text: "1"
            - button "next" [disabled] [ref=e13]:
              - img "next" [ref=e14]
          - img
        - generic [ref=e16]:
          - generic [ref=e17]:
            - img [ref=e18]
            - generic "Latest available version is detected (16.2.7)." [ref=e20]: Next.js 16.2.7
            - generic [ref=e21]: Turbopack
          - img
      - dialog "Build Error" [ref=e23]:
        - generic [ref=e26]:
          - generic [ref=e27]:
            - generic [ref=e28]:
              - generic [ref=e30]: Build Error
              - generic [ref=e31]:
                - button "Copy Error Info" [ref=e32] [cursor=pointer]:
                  - img [ref=e33]
                - link "Go to related documentation" [ref=e35] [cursor=pointer]:
                  - /url: https://nextjs.org/docs/messages/module-not-found
                  - img [ref=e36]
                - button "Attach Node.js inspector" [ref=e38] [cursor=pointer]:
                  - img [ref=e39]
            - generic [ref=e48]: "Module not found: Can't resolve './Inventory.module.scss'"
          - generic [ref=e50]:
            - generic [ref=e52]:
              - img [ref=e54]
              - generic [ref=e57]: ./src/pages/inventory/create.tsx (5:1)
              - button "Open in editor" [ref=e58] [cursor=pointer]:
                - img [ref=e60]
            - generic [ref=e63]:
              - generic [ref=e64]: "Module not found: Can't resolve './Inventory.module.scss'"
              - generic [ref=e65]: 3 |
              - text: import
              - generic [ref=e66]: useSWR
              - text: from 'swr'
              - generic [ref=e67]: ;
              - generic [ref=e68]: 4 |
              - text: import Metadata from '@/components/Metadata'
              - generic [ref=e69]: ;
              - text: ">"
              - generic [ref=e70]: 5 |
              - text: import
              - generic [ref=e71]: styles
              - text: from './Inventory.module.scss'
              - generic [ref=e72]: ;
              - generic [ref=e73]: "|"
              - text: ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
              - generic [ref=e74]: 6 |
              - generic [ref=e75]: 7 |
              - text: const
              - generic [ref=e76]: "fetcher = (url: string):"
              - text: Promise<Ingredient
              - generic [ref=e77]: "[]> =>"
              - generic [ref=e78]: 8 |
              - generic [ref=e79]:
                - text: fetch(url).then((res) => res.json());
                - link "https://nextjs.org/docs/messages/module-not-found" [ref=e80] [cursor=pointer]:
                  - /url: https://nextjs.org/docs/messages/module-not-found
        - generic [ref=e81]: "1"
        - generic [ref=e82]: "2"
    - generic [ref=e87] [cursor=pointer]:
      - button "Open Next.js Dev Tools" [ref=e88]:
        - img [ref=e89]
      - button "Open issues overlay" [ref=e93]:
        - generic [ref=e94]:
          - generic [ref=e95]: "0"
          - generic [ref=e96]: "1"
        - generic [ref=e97]: Issue
  - alert [ref=e98]
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
  47  |     await expect(page.getByText('Milk')).toBeVisible();
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
> 79  |     await page.getByLabel('Ingredient').selectOption({ label: 'Milk' });
      |                                         ^ Error: locator.selectOption: Test timeout of 30000ms exceeded.
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