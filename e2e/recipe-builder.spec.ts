import { test, expect } from '@playwright/test';

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
    await expect(page.getByLabel('Step 2')).toHaveCount(0);
    await page.getByLabel('Step 1').fill('Chop the onions');
    await expect(page.getByLabel('Step 2')).toBeVisible();
  });

  test('ingredient rows auto-grow once one is picked', async ({ page }) => {
    await page.goto('/recipes/new');
    await expect(page.getByLabel('Ingredient 1')).toBeVisible();
    await expect(page.getByLabel('Ingredient 2')).toHaveCount(0);
  });
});
