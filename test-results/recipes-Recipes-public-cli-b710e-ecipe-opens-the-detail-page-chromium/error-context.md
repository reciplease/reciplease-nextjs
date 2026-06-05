# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recipes.spec.ts >> Recipes (public) >> clicking a recipe opens the detail page
- Location: e2e\recipes.spec.ts:16:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByText('Toast')

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
  12 |     await expect(page.getByText('Toast')).toBeVisible();
  13 |     await expect(page.getByText('Yimmy Pork Belly')).toBeVisible();
  14 |   });
  15 | 
  16 |   test('clicking a recipe opens the detail page', async ({ page }) => {
  17 |     await page.goto('/recipes');
> 18 |     await page.getByText('Toast').click();
     |                                   ^ Error: locator.click: Test timeout of 30000ms exceeded.
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