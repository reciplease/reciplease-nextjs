import { test, expect } from '@playwright/test';

test.describe('Recipes (public)', () => {
  test('recipes page loads without sign-in', async ({ page }) => {
    await page.goto('/recipes');
    await expect(page).toHaveTitle(/Recipes/i);
    await expect(page.getByText('Toast')).toBeVisible();
  });

  test('recipe list shows all recipes', async ({ page }) => {
    await page.goto('/recipes');
    await expect(page.getByText('Toast')).toBeVisible();
    await expect(page.getByText('Yimmy Pork Belly')).toBeVisible();
  });

  test('clicking a recipe opens the detail page', async ({ page }) => {
    await page.goto('/recipes');
    await page.getByRole('link', { name: /Toast/ }).click();
    await expect(page).toHaveURL(/\/recipes\//);
    await expect(page.getByRole('heading', { name: 'Toast' })).toBeVisible();
  });

  test('recipe detail shows ingredients and steps', async ({ page }) => {
    await page.goto('/recipes');
    await page.getByRole('link', { name: /Toast/ }).click();
    await expect(page.getByRole('heading', { name: 'Ingredients' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Method' })).toBeVisible();
    await expect(page.getByText(/Spread butter on toast/i)).toBeVisible();
  });

  test('redirects / to /recipes', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/recipes/);
  });
});
