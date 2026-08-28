import { test, expect, Page } from '@playwright/test';

// These deliberately mock recipes/pantry with long names — that's what
// exposed the "Load ingredients" button being pushed off-screen on mobile
// (a flex-1 <select> won't shrink below its content's width unless given
// min-w-0, so a long recipe/pantry-item name blew the row wider than the
// viewport and shoved the button out of view).

async function mockSession(page: Page) {
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      json: { user: { name: 'Owner', email: 'owner@example.com' }, expires: '2099-01-01T00:00:00.000Z' },
    }),
  );
  await page.route('**/api/houses', (route) =>
    route.fulfill({ json: [{ id: 'house-1', name: 'Home', role: 'OWNER' }] }),
  );
  await page.route('**/api/recipes', (route) =>
    route.fulfill({
      json: [
        {
          recipeId: 'r1',
          name: 'A Genuinely Very Long Recipe Name That Should Not Fit On One Line',
          owned: true,
          ingredients: [
            { name: 'Plain flour', measure: 'g', amount: 200 },
            { name: 'Caster sugar', measure: 'g', amount: 100 },
          ],
        },
      ],
    }),
  );
  await page.route('**/api/pantry', (route) =>
    route.fulfill({
      json: [
        {
          uuid: 'i1',
          name: 'A Fairly Long Branded Pantry Item Name',
          brand: 'Some Brand',
          remaining: 5,
          measure: 'g',
        },
      ],
    }),
  );
}

test.describe('Planner form — plan a meal', () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page);
    await page.goto('/planner/new');
  });

  test('never causes horizontal page overflow, even with long recipe/pantry names', async ({ page }) => {
    await page.getByLabel('Recipe', { exact: true }).selectOption('r1');
    await page.getByRole('button', { name: 'Load ingredients' }).click();
    await expect(page.getByLabel('Ingredient name', { exact: true }).first()).toHaveValue('Plain flour');

    const [bodyWidth, viewportWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
  });

  test('the "Load ingredients" button stays visible and clickable after picking a recipe', async ({ page }) => {
    const loadButton = page.getByRole('button', { name: 'Load ingredients' });
    await expect(loadButton).toBeDisabled();

    await page.getByLabel('Recipe', { exact: true }).selectOption('r1');
    await expect(loadButton).toBeEnabled();
    await expect(loadButton).toBeInViewport();

    await loadButton.click();
    await expect(page.getByLabel('Ingredient name', { exact: true }).first()).toHaveValue('Plain flour');
    await expect(page.getByLabel('Ingredient name', { exact: true }).nth(1)).toHaveValue('Caster sugar');
  });

  test('loading ingredients from a recipe does not duplicate ingredients already on the form', async ({ page }) => {
    await page.getByLabel('New ingredient name').fill('Plain flour');
    await page.getByLabel('New ingredient amount').fill('50');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByLabel('Ingredient name', { exact: true })).toHaveCount(1);

    await page.getByLabel('Recipe', { exact: true }).selectOption('r1');
    await page.getByRole('button', { name: 'Load ingredients' }).click();

    // Existing "Plain flour" row is left alone; only "Caster sugar" is appended.
    await expect(page.getByLabel('Ingredient name', { exact: true })).toHaveCount(2);
    await expect(page.getByLabel('Ingredient name', { exact: true }).first()).toHaveValue('Plain flour');
    await expect(page.getByLabel('Amount', { exact: true }).first()).toHaveValue('50');
  });

  test('the "From stock" allocation row with a long pantry item name stays on-screen', async ({ page }) => {
    await page.getByLabel('Recipe', { exact: true }).selectOption('r1');
    await page.getByRole('button', { name: 'Load ingredients' }).click();

    await page.getByLabel('From stock:').first().selectOption('i1');
    await expect(page.getByLabel('Amount used from stock').first()).toBeInViewport();

    const [bodyWidth, viewportWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
  });
});
