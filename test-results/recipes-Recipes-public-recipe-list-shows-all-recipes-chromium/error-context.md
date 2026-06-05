# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recipes.spec.ts >> Recipes (public) >> recipe list shows all recipes
- Location: e2e\recipes.spec.ts:10:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Toast')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Toast')

```

```yaml
- banner:
  - heading "Reciplease" [level=1]
  - button "Sign in with Google"
- main:
  - paragraph: No recipes found
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
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Recipes (public)', () => {
  4  |   test('recipes page loads without sign-in', async ({ page }) => {
  5  |     await page.goto('/recipes');
  6  |     await expect(page).toHaveTitle(/Recipes/i);
  7  |     await expect(page.getByRole('heading', { name: /recipes/i })).toBeVisible();
  8  |   });
  9  | 
  10 |   test('recipe list shows all recipes', async ({ page }) => {
  11 |     await page.goto('/recipes');
> 12 |     await expect(page.getByText('Toast')).toBeVisible();
     |                                           ^ Error: expect(locator).toBeVisible() failed
  13 |     await expect(page.getByText('Yimmy Pork Belly')).toBeVisible();
  14 |   });
  15 | 
  16 |   test('clicking a recipe opens the detail page', async ({ page }) => {
  17 |     await page.goto('/recipes');
  18 |     await page.getByText('Toast').click();
  19 |     await expect(page).toHaveURL(/\/recipes\//);
  20 |     await expect(page.getByRole('heading', { name: 'Toast' })).toBeVisible();
  21 |   });
  22 | 
  23 |   test('recipe detail shows ingredients and steps', async ({ page }) => {
  24 |     await page.goto('/recipes');
  25 |     await page.getByText('Toast').click();
  26 |     await expect(page.getByText('bread')).toBeVisible();
  27 |     await expect(page.getByText('butter')).toBeVisible();
  28 |     await expect(page.getByText(/Toast the bread/i)).toBeVisible();
  29 |   });
  30 | 
  31 |   test('redirects / to /recipes', async ({ page }) => {
  32 |     await page.goto('/');
  33 |     await expect(page).toHaveURL(/\/recipes/);
  34 |   });
  35 | });
  36 | 
```