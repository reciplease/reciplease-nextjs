import { Page } from '@playwright/test';

const mockMeasures = [
  { measureId: 'GRAMS', singular: 'gram', plural: 'grams', short: 'g' },
  { measureId: 'ITEMS', singular: 'item', plural: 'items', short: 'item' },
];

const baseRecipe = {
  isPublic: true,
  sourceUrl: '',
  updatedAt: '2026-01-01T00:00:00.000Z',
  upvoteCount: 3,
  upvotedByCurrentUser: false,
};

const toast = {
  ...baseRecipe,
  recipeId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  name: 'Toast',
  description: 'Crisp bread with butter',
  ingredients: [
    { name: 'Bread', measure: 'ITEMS', amount: 2 },
    { name: 'Butter', measure: 'GRAMS', amount: 10 },
  ],
  method: { steps: ['Toast the bread', 'Spread butter on toast'] },
};

const porkBelly = {
  ...baseRecipe,
  recipeId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
  name: 'Yimmy Pork Belly',
  description: 'Slow roasted pork belly',
  ingredients: [{ name: 'Pork belly', measure: 'GRAMS', amount: 1000 }],
  method: { steps: ['Roast the pork belly'] },
};

const recipes = [toast, porkBelly];

export async function mockPublicRecipes(page: Page) {
  await page.route('**/api/measures', (route) => route.fulfill({ json: mockMeasures }));
  await page.route('**/api/recipes', (route) => route.fulfill({ json: recipes }));
  for (const recipe of recipes) {
    await page.route(`**/api/recipes/${recipe.recipeId}`, (route) => route.fulfill({ json: recipe }));
  }
}
