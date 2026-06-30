import { test, expect } from '@playwright/test';

// Cross-page View Transitions (useViewTransitionRouter) were removed in favour
// of the App Router's native support post-migration — see the NOTE in
// src/pages/_app.tsx. This only covers that client-side navigation itself
// still works; it no longer asserts anything about document.startViewTransition.
test.describe('Recipe navigation', () => {
  test('client-side navigation still lands on the right page', async ({ page }) => {
    await page.goto('/recipes');
    // Wait for the SPA to hydrate before clicking — a click that lands before
    // React attaches its handlers falls through to a plain browser navigation.
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: /Toast/ }).click();
    await expect(page).toHaveURL(/\/recipes\//);
    await expect(page.getByRole('heading', { name: 'Toast' })).toBeVisible();
  });
});
