import AxeBuilder from '@axe-core/playwright';
import { test, expect, Page } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

const mockMeasures = [
  { measureId: 'GRAMS', singular: 'gram', plural: 'grams', short: 'g' },
  { measureId: 'ITEMS', singular: 'item', plural: 'items', short: 'item' },
  { measureId: 'ML', singular: 'millilitre', plural: 'millilitres', short: 'ml' },
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
        handsOff: false,
        duration: { minMinutes: 10, maxMinutes: 12 },
        inputs: [
          { text: 'Mix the flour', inputs: [], handsOff: false, duration: { minMinutes: 5, maxMinutes: 5 } },
          { text: 'Whisk the egg', inputs: [], handsOff: true, duration: { minMinutes: 2, maxMinutes: 3 } },
        ],
      },
      {
        text: 'Bake until golden',
        inputs: [],
        handsOff: true,
        duration: { minMinutes: 20, maxMinutes: 25 },
      },
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

const sourceRecipeId = 'cccccccccccccccccccccccc';
const sourceRecipeShortId = 'zMzMzMzMzMzMzMzM';
const sourceUrl = 'https://example.com/recipes/pancakes';

const sourceRecipe = {
  ...listRecipe,
  recipeId: sourceRecipeId,
  name: 'Sourced Recipe',
  sourceUrl,
};

const today = new Date().toLocaleDateString('en-CA');

const pantryItem = {
  uuid: 'item-1',
  houseId: 'house-1',
  name: 'Milk',
  brand: 'Happy Cow',
  measure: 'ML',
  amount: 1000,
  remaining: 500,
  expiration: '2099-12-31',
  barcode: '5012345678900',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.000Z',
};

const expiredPantryItem = {
  ...pantryItem,
  uuid: 'item-2',
  name: 'Yoghurt',
  brand: undefined,
  expiration: '2020-01-01',
};

const pendingItems = [
  { uuid: 'pending-1', houseId: 'house-1', updatedAt: '2026-01-02T10:00:00.000Z' },
  { uuid: 'pending-2', houseId: 'house-1', legacyBarcode: '5449000000996', updatedAt: '2026-01-02T11:00:00.000Z' },
];

const plannedMealId = 'cccccccccccccccccccccccc';
const plannedMealShortId = 'zMzMzMzMzMzMzMzM';

const plannedMeal = {
  plannedMealId,
  houseId: 'house-1',
  name: 'Pancake supper',
  date: today,
  recipe: listRecipe,
  items: [
    {
      ingredient: { name: 'Flour', measure: 'GRAMS', amount: 200 },
      allocations: [{ pantryItemId: 'item-1', amount: 200 }],
    },
    { ingredient: { name: 'Egg', measure: 'ITEMS', amount: 2 }, allocations: [] },
  ],
};

const eatenPlannedMeal = {
  ...plannedMeal,
  plannedMealId: 'dddddddddddddddddddddddd',
  name: 'Soup lunch',
  recipe: undefined,
  eatenAt: '2026-01-01T12:00:00.000Z',
};

const baseResponses: Record<string, unknown> = {
  '/api/auth/session': {
    user: { name: 'Owner', email: 'owner@example.com' },
    expires: '2099-01-01T00:00:00.000Z',
  },
  '/api/houses': [
    { id: 'house-1', name: 'Home', role: 'OWNER' },
    { id: 'house-2', name: 'Holiday cottage', role: 'READ_ONLY' },
  ],
  '/api/measures': mockMeasures,
  '/api/pantry/pending': [],
  '/api/google-health/connection': { connected: false },
};

async function mockApi(page: Page, responses: Record<string, unknown>) {
  const allResponses = { ...baseResponses, ...responses };
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => {
      const request = route.request();
      const { pathname } = new URL(request.url());
      if (request.method() === 'GET' && pathname in allResponses) {
        return route.fulfill({ json: allResponses[pathname] });
      }
      return route.abort();
    },
  );
}

async function contrastViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .exclude('nextjs-portal')
    .withRules(['color-contrast'])
    .analyze();
  return violations.flatMap((violation) =>
    violation.nodes.map((node) => ({
      target: node.target,
      html: node.html,
      failureSummary: node.failureSummary,
    })),
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

  test('a table recipe with durations, before and after ticking cells', async ({ page }) => {
    await mockSession(page);
    await mockRecipes(page);
    await page.goto(`/recipes/${shortIds[tableRecipeId]}`);
    await expect(page.getByText('Total 25 min')).toBeVisible();
    await expect(page.getByText('start 17 min before end').first()).toBeVisible();
    await expect(page.getByText('hands-off').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Bake until golden/ })).toHaveCSS('border-left-width', '8px');
    expect(await contrastViolations(page)).toEqual([]);

    await page.getByRole('button', { name: /^Whisk the egg/ }).click();
    await page.getByRole('button', { name: /^Bake until golden/ }).click();
    await expect(page.getByRole('button', { name: /^Bake until golden/ })).toHaveAttribute('aria-pressed', 'true');
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

test.describe('Colour contrast: recipe source links', () => {
  const recipeResponses = {
    '/api/recipes': [sourceRecipe],
    [`/api/recipes/${sourceRecipeId}`]: sourceRecipe,
  };

  test('a recipe detail page with a link preview', async ({ page }) => {
    await mockApi(page, {
      ...recipeResponses,
      '/api/link-preview': {
        type: 'website',
        title: 'Perfect pancakes',
        siteName: 'example.com',
        image: null,
        recipeMeta: { time: '25 min', servings: '4 servings', rating: { value: 4.5, count: 1200 } },
      },
    });
    await page.goto(`/recipes/${sourceRecipeShortId}`);
    await expect(page.getByText('Perfect pancakes')).toBeVisible();
    expect(await contrastViolations(page)).toEqual([]);
  });

  test('a recipe detail page whose link preview failed', async ({ page }) => {
    await mockApi(page, recipeResponses);
    await page.goto(`/recipes/${sourceRecipeShortId}`);
    await expect(page.getByText(`Source: ${sourceUrl}`)).toBeVisible();
    expect(await contrastViolations(page)).toEqual([]);
  });

  test('the recipe edit page', async ({ page }) => {
    await mockApi(page, recipeResponses);
    await page.goto(`/recipes/${sourceRecipeShortId}/edit`);
    await expect(page.getByText(`Source: ${sourceUrl}`)).toBeVisible();
    expect(await contrastViolations(page)).toEqual([]);
  });
});

test.describe('Colour contrast: planner', () => {
  const plannerResponses = {
    '/api/planned-meals': [plannedMeal, eatenPlannedMeal],
    '/api/planned-meals/suggestions': [],
    [`/api/planned-meals/${plannedMealId}`]: plannedMeal,
    '/api/planned-meals/shopping-list': {
      items: [
        { name: 'Flour', measure: 'GRAMS', amount: 200 },
        { name: 'Egg', measure: 'ITEMS', amount: 2 },
      ],
    },
    '/api/recipes': [listRecipe],
    '/api/pantry': [pantryItem],
  };

  test.beforeEach(async ({ page }) => {
    await mockApi(page, plannerResponses);
  });

  test('/planner with planned meals', async ({ page }) => {
    await page.goto('/planner');
    await expect(page.getByText('Pancake supper')).toBeVisible();
    await expect(page.getByText('Eaten', { exact: true })).toBeVisible();
    expect(await contrastViolations(page)).toEqual([]);
  });

  test('/planner/shopping-list', async ({ page }) => {
    await page.goto('/planner/shopping-list');
    await expect(page.getByText('Flour')).toBeVisible();
    expect(await contrastViolations(page)).toEqual([]);
  });

  test('the new planned meal form', async ({ page }) => {
    await page.goto('/planner/new');
    await expect(page.getByText(/No ingredients yet/)).toBeVisible();
    expect(await contrastViolations(page)).toEqual([]);
  });

  test('the edit planned meal form', async ({ page }) => {
    await page.goto(`/planner/${plannedMealShortId}/edit`);
    await expect(page.getByLabel('Ingredient name', { exact: true }).first()).toHaveValue('Flour');
    await expect(page.getByText('From stock:').first()).toBeVisible();
    expect(await contrastViolations(page)).toEqual([]);
  });
});

test.describe('Colour contrast: pantry', () => {
  const pantryResponses = {
    '/api/pantry': [pantryItem, expiredPantryItem],
    '/api/pantry/pending': pendingItems,
    [`/api/pantry/${pantryItem.uuid}`]: pantryItem,
    [`/api/pantry/pending/${pendingItems[1].uuid}`]: pendingItems[1],
  };

  test.beforeEach(async ({ page }) => {
    await mockApi(page, pantryResponses);
    await page.route('https://world.openfoodfacts.org/**', (route) =>
      route.fulfill({
        json: {
          status: 1,
          product: {
            product_name: 'Semi skimmed milk',
            generic_name: 'Milk',
            brands: 'Happy Cow, Moo',
            quantity: '1 l',
          },
        },
      }),
    );
  });

  test('/pantry sorted by name', async ({ page }) => {
    await page.goto('/pantry');
    await expect(page.getByText('Milk')).toBeVisible();
    await expect(page.getByRole('link', { name: /Process 2 captured items/ })).toBeVisible();
    expect(await contrastViolations(page)).toEqual([]);
  });

  test('/pantry sorted by expiration', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('pantry:sortBy', '"expiration"'));
    await page.goto('/pantry');
    await expect(page.getByRole('heading', { name: 'Within a week' })).toBeVisible();
    await expect(page.getByText('Milk')).toBeVisible();
    expect(await contrastViolations(page)).toEqual([]);
  });

  test('a pantry item detail page', async ({ page }) => {
    await page.goto(`/pantry/${pantryItem.uuid}`);
    await expect(page.getByRole('heading', { name: 'Milk' })).toBeVisible();
    await expect(page.getByText(/Barcode:/)).toBeVisible();
    expect(await contrastViolations(page)).toEqual([]);
  });

  test('a pantry item edit page', async ({ page }) => {
    await page.goto(`/pantry/${pantryItem.uuid}/edit`);
    await expect(page.getByRole('heading', { name: 'Edit Milk' })).toBeVisible();
    await expect(page.getByLabel('Measure')).toBeEnabled();
    expect(await contrastViolations(page)).toEqual([]);
  });

  test('/pantry/shop', async ({ page }) => {
    await page.goto('/pantry/shop');
    await expect(page.getByRole('heading', { name: 'Add a whole shop' })).toBeVisible();
    await expect(page.getByText('2 items captured')).toBeVisible();
    expect(await contrastViolations(page)).toEqual([]);
  });

  test('/pantry/shop/process', async ({ page }) => {
    await page.goto('/pantry/shop/process');
    await expect(page.getByRole('heading', { name: 'Process captured items' })).toBeVisible();
    await expect(page.getByText(/Scanned/).first()).toBeVisible();
    expect(await contrastViolations(page)).toEqual([]);
  });

  test('processing a captured item', async ({ page }) => {
    await page.goto(`/pantry/shop/process/${pendingItems[1].uuid}`);
    await expect(page.getByRole('button', { name: 'Semi skimmed milk', exact: true })).toBeVisible();
    await expect(page.getByText('No photo captured').first()).toBeVisible();
    expect(await contrastViolations(page)).toEqual([]);
  });

  test.describe('the scan page', () => {
    async function lookUpBarcode(page: Page) {
      await page.goto('/pantry/scan');
      await page.getByLabel('Or enter a barcode manually').fill('5449000000996');
      await page.getByRole('button', { name: 'Look up' }).click();
      await expect(page.getByRole('heading', { name: 'New pantry item' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Semi skimmed milk', exact: true })).toBeVisible();
    }

    test('waiting for a barcode', async ({ page }) => {
      await page.goto('/pantry/scan');
      await expect(page.getByLabel('Or enter a barcode manually')).toBeVisible();
      expect(await contrastViolations(page)).toEqual([]);
    });

    test('confirming the item details', async ({ page }) => {
      await lookUpBarcode(page);
      expect(await contrastViolations(page)).toEqual([]);
    });

    test('entering the expiration date', async ({ page }) => {
      await lookUpBarcode(page);
      await page.getByRole('button', { name: 'Continue →' }).click();
      await expect(page.getByText('Enter expiration date')).toBeVisible();
      expect(await contrastViolations(page)).toEqual([]);
    });

    test('entering the measure and amount', async ({ page }) => {
      await lookUpBarcode(page);
      await page.getByRole('button', { name: 'Continue →' }).click();
      await page.getByRole('button', { name: 'Continue →' }).click();
      await expect(page.getByRole('button', { name: '← Edit date' })).toBeVisible();
      expect(await contrastViolations(page)).toEqual([]);
    });

    test('choosing a measure from the open list', async ({ page }) => {
      await lookUpBarcode(page);
      await page.getByRole('button', { name: 'Continue →' }).click();
      await page.getByRole('button', { name: 'Continue →' }).click();
      await page.getByRole('button', { name: /Select measure|litre/ }).click();
      await expect(page.getByPlaceholder('Search measures…')).toBeVisible();
      expect(await contrastViolations(page)).toEqual([]);
    });

    test('searching for a measure that does not exist', async ({ page }) => {
      await lookUpBarcode(page);
      await page.getByRole('button', { name: 'Continue →' }).click();
      await page.getByRole('button', { name: 'Continue →' }).click();
      await page.getByRole('button', { name: /Select measure|litre/ }).click();
      await page.getByPlaceholder('Search measures…').fill('zzz');
      await expect(page.getByText('No measures found')).toBeVisible();
      expect(await contrastViolations(page)).toEqual([]);
    });
  });
});

test.describe('Colour contrast: settings', () => {
  const identities = {
    identities: [
      { provider: 'google', email: 'owner@example.com' },
      { provider: 'github', email: null },
    ],
  };

  test('/settings with Google Health disconnected', async ({ page }) => {
    await mockApi(page, { '/api/me/identities': identities });
    await page.goto('/settings');
    await expect(page.getByRole('link', { name: 'Link Google Health' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unlink Google' })).toBeVisible();
    expect(await contrastViolations(page)).toEqual([]);
  });

  test('/settings with Google Health connected', async ({ page }) => {
    await mockApi(page, {
      '/api/me/identities': identities,
      '/api/google-health/connection': { connected: true },
    });
    await page.goto('/settings');
    await expect(page.getByText('Connected', { exact: true })).toBeVisible();
    expect(await contrastViolations(page)).toEqual([]);
  });

  test('/settings/house as an owner', async ({ page }) => {
    await mockApi(page, {
      '/api/houses/members': [
        { userId: 'owner-1', handle: 'owner-handle', role: 'OWNER' },
        { userId: 'member-1', handle: 'member-handle', role: 'READ_ONLY' },
      ],
      '/api/houses/invites': [
        { id: 'invite-1', code: 'abc123def456ghi789jk', role: 'READ_ONLY', createdAt: '2026-01-01T00:00:00.000Z' },
      ],
      '/api/houses/api-keys': [
        {
          id: 'key-1',
          name: 'Home Assistant',
          role: 'READ_ONLY',
          keyPrefix: 'rcpl_abcdefghij',
          createdAt: '2026-01-01T00:00:00.000Z',
          lastUsedAt: null,
        },
      ],
    });
    await page.goto('/settings/house');
    await expect(page.getByText('member-handle')).toBeVisible();
    await expect(page.getByText('abc123def456ghi789jk')).toBeVisible();
    await expect(page.getByText('rcpl_abcdefghij')).toBeVisible();
    expect(await contrastViolations(page)).toEqual([]);
  });

  test('/settings/house with nothing created yet', async ({ page }) => {
    await mockApi(page, {
      '/api/houses/members': [{ userId: 'owner-1', handle: 'owner-handle', role: 'OWNER' }],
      '/api/houses/invites': [],
      '/api/houses/api-keys': [],
    });
    await page.goto('/settings/house');
    await expect(page.getByText('No pending invites.')).toBeVisible();
    await expect(page.getByText('No API keys yet.')).toBeVisible();
    expect(await contrastViolations(page)).toEqual([]);
  });
});
