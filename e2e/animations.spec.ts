import { test, expect } from '@playwright/test';

// Functional regression guard for useViewTransitionRouter, not a pixel
// comparison — confirms the View Transitions wiring doesn't break navigation
// and actually fires/skips document.startViewTransition as expected.

async function spyOnStartViewTransition(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    (window as unknown as { __startViewTransitionCalls: number }).__startViewTransitionCalls = 0;
    const doc = window.document as unknown as {
      startViewTransition?: (cb: () => void | Promise<void>) => unknown;
    };
    doc.startViewTransition = (callback: () => void | Promise<void>) => {
      (window as unknown as { __startViewTransitionCalls: number }).__startViewTransitionCalls += 1;
      callback();
      return {
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
        finished: Promise.resolve(),
        skipTransition: () => {},
      };
    };
  });
}

test.describe('View Transitions', () => {
  test('client-side navigation still lands on the right page', async ({ page }) => {
    await spyOnStartViewTransition(page);
    await page.goto('/recipes');
    // Wait for the SPA to hydrate before clicking — a click that lands before
    // React attaches its handlers falls through to a plain browser
    // navigation, which never reaches useViewTransitionRouter at all.
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: /Toast/ }).click();
    await expect(page).toHaveURL(/\/recipes\//);
    await expect(page.getByRole('heading', { name: 'Toast' })).toBeVisible();
  });

  test('starts a view transition on a real client-side navigation', async ({ page }) => {
    await spyOnStartViewTransition(page);
    await page.goto('/recipes');
    // Wait for the SPA to hydrate before clicking — a click that lands before
    // React attaches its handlers falls through to a plain browser
    // navigation, which never reaches useViewTransitionRouter at all.
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: /Toast/ }).click();
    await expect(page.getByRole('heading', { name: 'Toast' })).toBeVisible();

    // `routeChangeStart` can fire a tick after the new page is already
    // visible (Next batches the route commit), so poll rather than reading
    // the counter immediately.
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { __startViewTransitionCalls: number }).__startViewTransitionCalls,
        ),
      )
      .toBeGreaterThan(0);
  });

  test('skips the transition when motion is set to reduced', async ({ page }) => {
    // The `.reduce-motion` class is applied by the settings store
    // (src/lib/settings.tsx) when the user explicitly picks "Reduced", or
    // automatically for `prefers-reduced-motion` users who visit /settings.
    // Setting it here exercises the same DOM contract useViewTransitionRouter
    // reads, without relying on OS-level media-query plumbing in CI.
    // The spy must be installed before the first navigation (addInitScript
    // only applies to future navigations), and we only soft-navigate from
    // here on, so installing it up front covers every click below too.
    await spyOnStartViewTransition(page);
    await page.goto('/settings');
    await page.getByRole('radio', { name: 'Reduced' }).check({ force: true });
    await expect(page.locator('html')).toHaveClass(/reduce-motion/);

    // Soft-navigate via the app's own nav link rather than page.goto, so the
    // .reduce-motion class (applied to <html> by the prior step) survives —
    // a full page.goto would reload the document and drop it, since the
    // settings store only re-applies the class from a mounted React effect.
    // On narrow viewports the nav is collapsed behind the hamburger menu.
    const recipesLink = page.getByRole('link', { name: 'Recipes' });
    if (!(await recipesLink.isVisible())) {
      await page.getByRole('button', { name: 'Menu' }).click();
    }
    await recipesLink.click();
    await page.getByRole('link', { name: /Toast/ }).click();
    await expect(page.getByRole('heading', { name: 'Toast' })).toBeVisible();

    // Give a late-firing routeChangeStart (see the previous test) a chance to
    // land before asserting it never called startViewTransition.
    await page.waitForTimeout(500);
    const calls = await page.evaluate(
      () => (window as unknown as { __startViewTransitionCalls: number }).__startViewTransitionCalls,
    );
    expect(calls).toBe(0);
  });
});
