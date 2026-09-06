import { test, expect } from '@playwright/test';

const mockMeasures = [
  { measureId: 'GRAMS', singular: 'gram', plural: 'grams', short: 'g' },
  { measureId: 'TABLESPOONS', singular: 'tablespoon', plural: 'tablespoons', short: 'tbsp' },
  { measureId: 'ITEMS', singular: 'item', plural: 'items', short: 'item' },
];

// The e2e server runs with NEXT_PUBLIC_AUTH_DISABLED=true, so the authenticated
// chrome (FAB + builder) is reachable. These cover the builder UI only; the
// search/save backend calls require a real session and aren't exercised here.
test.describe('Recipe builder', () => {
  test('the + FAB opens the builder', async ({ page }) => {
    await page.goto('/recipes');
    await page.getByRole('link', { name: 'New recipe' }).click();
    await expect(page).toHaveURL(/\/recipes\/new/);
    await expect(page.getByPlaceholder('Recipe title...')).toBeVisible();
  });

  test('steps auto-grow as you type', async ({ page }) => {
    await page.goto('/recipes/new');
    // exact: true — "Step 1" is otherwise a substring match of the row's
    // "Remove step 1" button label too.
    await expect(page.getByLabel('Step 2', { exact: true })).toHaveCount(0);
    await page.getByLabel('Step 1', { exact: true }).fill('Chop the onions');
    await expect(page.getByLabel('Step 2', { exact: true })).toBeVisible();
  });

  test('ingredient rows auto-grow once one is picked', async ({ page }) => {
    await page.goto('/recipes/new');
    await expect(page.getByLabel('Ingredient 1')).toBeVisible();
    await expect(page.getByLabel('Ingredient 2')).toHaveCount(0);
  });

  test('the amount field and remove button stay fully on-screen, even on a narrow viewport', async ({ page }) => {
    await page.route('/api/measures', (route) => route.fulfill({ json: mockMeasures }));
    await page.goto('/recipes/new');

    await page.getByLabel('Ingredient 1').fill('Flour');

    await expect(page.getByLabel('Amount 1')).toBeInViewport({ ratio: 1 });
    await expect(page.getByLabel('Remove ingredient 1')).toBeInViewport({ ratio: 1 });
  });
});
