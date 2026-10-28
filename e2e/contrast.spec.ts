import AxeBuilder from '@axe-core/playwright';
import { test, expect, Page } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

const mockMeasures = [
  { measureId: 'GRAMS', singular: 'gram', plural: 'grams', short: 'g' },
  { measureId: 'ITEMS', singular: 'item', plural: 'items', short: 'item' },
];

const listRecipeId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const tableRecipeId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const shortIds: Record<string, string> = {
  [listRecipeId]: 'qqqqqqqqqqqqqqqq',
  [tableRecipeId]: 'u7u7u7u7u7u7u7u7',
};

const baseRecipe = {
  isPublic: true,
  description: 'A simple test recipe',
  sourceUrl: '',
  ingredients: [
    { name: 'Flour', measure: 'GRAMS', amount: 200 },
    { name: 'Egg', measure: 'ITEMS', amount: 1 },
  ],
  updatedAt: '2026-01-01T00:00:00.000Z',
  upvoteCount: 3,
  upvotedByCurrentUser: false,
};

const listRecipe = {
  ...baseRecipe,
  recipeId: listRecipeId,
  name: 'List Recipe',
  method: { steps: ['Mix the flour and egg', 'Bake until golden'] },
  ownership: {},
};

const tableRecipe = {
  ...baseRecipe,
  recipeId: tableRecipeId,
  name: 'Table Recipe',
  method: {
    cells: [
      {
        text: 'Combine',
        inputs: [
          { text: 'Mix the flour', inputs: [] },
          { text: 'Whisk the egg', inputs: [] },
        ],
      },
      { text: 'Bake until golden', inputs: [] },
    ],
  },
};

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
  await page.route('**/api/measures', (route) => route.fulfill({ json: mockMeasures }));
}

async function mockRecipes(page: Page) {
  await page.route('**/api/recipes', (route) => route.fulfill({ json: [listRecipe, tableRecipe] }));
  await page.route(`**/api/recipes/${listRecipeId}`, (route) => route.fulfill({ json: listRecipe }));
  await page.route(`**/api/recipes/${tableRecipeId}`, (route) => route.fulfill({ json: tableRecipe }));
}

async function contrastViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  return violations.flatMap((violation) =>
    violation.nodes.map((node) => ({ target: node.target, failureSummary: node.failureSummary })),
  );
}

test.describe('Colour contrast: loading states', () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page);
  });

  test('/recipes while loading', async ({ page }) => {
    await page.route('**/api/recipes', () => {});
    await page.goto('/recipes');
    await expect(page.getByRole('status')).toBeVisible();
    expect(await contrastViolations(page)).toEqual([]);
  });

  test('a recipe detail page while loading', async ({ page }) => {
    await page.route(`**/api/recipes/${listRecipeId}`, () => {});
    await page.goto(`/recipes/${shortIds[listRecipeId]}`);
    await expect(page.getByRole('status')).toBeVisible();
    expect(await contrastViolations(page)).toEqual([]);
  });

  test('/pantry while loading', async ({ page }) => {
    await page.route('**/api/pantry', () => {});
    await page.goto('/pantry');
    await expect(page.getByRole('status')).toBeVisible();
    expect(await contrastViolations(page)).toEqual([]);
  });
});

test.describe('Colour contrast: loaded states', () => {
  test('/recipes list', async ({ page }) => {
    await mockSession(page);
    await mockRecipes(page);
    await page.goto('/recipes');
    await expect(page.getByText('List Recipe')).toBeVisible();
    expect(await contrastViolations(page)).toEqual([]);
  });

  test('a recipe detail page in list mode', async ({ page }) => {
    await mockSession(page);
    await mockRecipes(page);
    await page.goto(`/recipes/${shortIds[listRecipeId]}`);
    await expect(page.getByRole('heading', { name: 'List Recipe' })).toBeVisible();
    await expect(page.getByText('Mix the flour and egg')).toBeVisible();
    expect(await contrastViolations(page)).toEqual([]);
  });

  test('a recipe detail page in table mode', async ({ page }) => {
    await mockSession(page);
    await mockRecipes(page);
    await page.goto(`/recipes/${shortIds[tableRecipeId]}`);
    await expect(page.getByRole('heading', { name: 'Table Recipe' })).toBeVisible();
    await expect(page.getByText('Whisk the egg')).toBeVisible();
    expect(await contrastViolations(page)).toEqual([]);
  });

  test('the login page', async ({ page }) => {
    await page.route('**/api/auth/session', (route) => route.fulfill({ json: {} }));
    await page.goto('/login');
    await expect(page.getByRole('main')).toBeVisible();
    expect(await contrastViolations(page)).toEqual([]);
  });

  test('/recipes/new', async ({ page }) => {
    await mockSession(page);
    await page.goto('/recipes/new');
    await expect(page.getByPlaceholder('Recipe title...')).toBeVisible();
    expect(await contrastViolations(page)).toEqual([]);
  });
});
