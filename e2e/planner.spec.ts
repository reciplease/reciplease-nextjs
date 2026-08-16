import { test, expect, Page } from '@playwright/test';

// Deliberately uses the real "today" (no page.clock) — faking the browser's
// clock to a fixed date doesn't affect the Next.js dev server's SSR pass,
// which runs with the real system time, so the two disagree on "today" and
// Next's dev error overlay (a full-page portal) intercepts every click.

async function mockSession(page: Page) {
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      json: {
        user: { name: 'Owner', email: 'owner@example.com' },
        expires: '2099-01-01T00:00:00.000Z',
      },
    }),
  );
  await page.route('**/api/houses', (route) =>
    route.fulfill({ json: [{ id: 'house-1', name: 'Home', role: 'OWNER' }] }),
  );
}

/**
 * Loads the planner with no planned meals and reads back, straight from the
 * rendered calendar, the Monday of the initially-selected week plus the
 * Monday of another week that's guaranteed to be part of the same month
 * (so selecting it later never triggers a month-view jump, which would
 * otherwise pull the selected week's row out of the DOM entirely).
 */
async function discoverWeeks(page: Page): Promise<{ selectedMonday: string; otherMonday: string }> {
  await page.route('**/api/planned-meals**', (route) => {
    if (route.request().method() === 'GET') route.fulfill({ json: [] });
    else route.continue();
  });
  await page.goto('/planner');

  const selectedLabel = await page
    .locator('button[aria-pressed="true"][aria-label^="Select week of "]')
    .first()
    .getAttribute('aria-label');
  const selectedMonday = selectedLabel!.replace('Select week of ', '');
  const monthPrefix = selectedMonday.slice(0, 7); // YYYY-MM

  const allLabels = await page
    .locator('button[aria-label^="Select week of "]')
    .evaluateAll((els) => Array.from(new Set(els.map((el) => el.getAttribute('aria-label')!))));
  const otherMonday = allLabels
    .map((label) => label.replace('Select week of ', ''))
    .find((iso) => iso !== selectedMonday && iso.startsWith(monthPrefix))!;

  return { selectedMonday, otherMonday };
}

// The Monday cell is always the first of the 7 day buttons sharing a given
// "Select week of X" aria-label, since each week row renders Mon..Sun in order.
function mondayCell(page: Page, weekMonday: string) {
  return page.locator(`button[aria-label="Select week of ${weekMonday}"]`).first();
}

test.describe('Planner calendar shading and planned-meal markers', () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page);
  });

  test('shades every week except the selected one', async ({ page }) => {
    const { selectedMonday, otherMonday } = await discoverWeeks(page);

    await expect(mondayCell(page, selectedMonday).locator('..')).not.toHaveClass(/bg-highlight\/20/);
    await expect(mondayCell(page, otherMonday).locator('..')).toHaveClass(/bg-highlight\/20/);
  });

  test('shows a dot under days with a planned meal, whether or not their week is selected', async ({ page }) => {
    const { selectedMonday, otherMonday } = await discoverWeeks(page);

    await page.unroute('**/api/planned-meals**');
    await page.route('**/api/planned-meals**', (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      route.fulfill({
        json: [
          { plannedMealId: 'meal-1', houseId: 'house-1', name: 'Roast dinner', date: selectedMonday, items: [] },
          { plannedMealId: 'meal-2', houseId: 'house-1', name: 'Fish and chips', date: otherMonday, items: [] },
        ],
      });
    });
    await page.reload();

    // Tuesday of the selected week — same row as the Monday meal, but itself unplanned.
    const unplannedDay = page.locator(`button[aria-label="Select week of ${selectedMonday}"]`).nth(1);

    await expect(mondayCell(page, selectedMonday).getByTestId('planned-meal-dot')).toBeVisible();
    await expect(mondayCell(page, otherMonday).getByTestId('planned-meal-dot')).toBeVisible();
    await expect(unplannedDay.getByTestId('planned-meal-dot')).toHaveCount(0);
  });

  test('selecting a different week moves the shading, not the meal dot', async ({ page }) => {
    const { selectedMonday, otherMonday } = await discoverWeeks(page);

    await page.unroute('**/api/planned-meals**');
    await page.route('**/api/planned-meals**', (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      route.fulfill({
        json: [{ plannedMealId: 'meal-2', houseId: 'house-1', name: 'Fish and chips', date: otherMonday, items: [] }],
      });
    });
    await page.reload();

    await mondayCell(page, otherMonday).click();

    await expect(mondayCell(page, otherMonday).locator('..')).not.toHaveClass(/bg-highlight\/20/);
    await expect(mondayCell(page, selectedMonday).locator('..')).toHaveClass(/bg-highlight\/20/);
    // The meal dot stays on 'otherMonday' regardless of it now being selected.
    await expect(mondayCell(page, otherMonday).getByTestId('planned-meal-dot')).toBeVisible();
  });
});
