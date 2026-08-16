import { test, expect, Page } from '@playwright/test';

// Fixed "today" so the calendar's initially-selected week (and therefore which
// weeks are shaded) is deterministic across runs. Wednesday 3 June 2026 falls
// in the week starting Monday 1 June 2026.
const TODAY = '2026-06-03T12:00:00.000Z';

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

const mockMeals = [
  // Within the initially-selected week (1-7 June).
  { plannedMealId: 'meal-1', houseId: 'house-1', name: 'Roast dinner', date: '2026-06-05', items: [] },
  // Outside it, in the week of 15 June — should still get a dot even though
  // that week is shaded, since the dot marks "has a meal", not "is selected".
  { plannedMealId: 'meal-2', houseId: 'house-1', name: 'Fish and chips', date: '2026-06-18', items: [] },
];

test.describe('Planner calendar shading and planned-meal markers', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date(TODAY) });
    await mockSession(page);
    await page.route('**/api/planned-meals**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ json: mockMeals });
      } else {
        route.continue();
      }
    });
    await page.goto('/planner');
  });

  test('shades every week except the selected one', async ({ page }) => {
    const selectedWeekDay = page
      .locator('button[aria-label="Select week of 2026-06-01"]')
      .filter({ hasText: /^5$/ });
    const otherWeekDay = page
      .locator('button[aria-label="Select week of 2026-06-15"]')
      .filter({ hasText: /^18$/ });

    await expect(selectedWeekDay.locator('..')).not.toHaveClass(/bg-highlight\/20/);
    await expect(otherWeekDay.locator('..')).toHaveClass(/bg-highlight\/20/);
  });

  test('shows a dot under days with a planned meal, whether or not their week is selected', async ({ page }) => {
    const plannedInSelectedWeek = page
      .locator('button[aria-label="Select week of 2026-06-01"]')
      .filter({ hasText: /^5$/ });
    const plannedInOtherWeek = page
      .locator('button[aria-label="Select week of 2026-06-15"]')
      .filter({ hasText: /^18$/ });
    const unplannedDay = page
      .locator('button[aria-label="Select week of 2026-06-01"]')
      .filter({ hasText: /^4$/ });

    await expect(plannedInSelectedWeek.getByTestId('planned-meal-dot')).toBeVisible();
    await expect(plannedInOtherWeek.getByTestId('planned-meal-dot')).toBeVisible();
    await expect(unplannedDay.getByTestId('planned-meal-dot')).toHaveCount(0);
  });

  test('selecting a different week moves the shading, not the meal dots', async ({ page }) => {
    const weekOf15June = page.locator('button[aria-label="Select week of 2026-06-15"]').first();
    await weekOf15June.click();

    const nowSelectedWeekDay = page
      .locator('button[aria-label="Select week of 2026-06-15"]')
      .filter({ hasText: /^18$/ });
    const nowUnselectedWeekDay = page
      .locator('button[aria-label="Select week of 2026-06-01"]')
      .filter({ hasText: /^5$/ });

    await expect(nowSelectedWeekDay.locator('..')).not.toHaveClass(/bg-highlight\/20/);
    await expect(nowUnselectedWeekDay.locator('..')).toHaveClass(/bg-highlight\/20/);
    // The meal dot on 18 June still shows now that its week is selected.
    await expect(nowSelectedWeekDay.getByTestId('planned-meal-dot')).toBeVisible();
  });
});
