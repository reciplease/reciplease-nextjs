/** @jest-environment node */
import { toRecipe, type BackendRecipe } from '@/lib/recipes';
import { shorten } from '@/lib/recipe-id';

const recipeId = '5f1d8a2b3c4d5e6f70819203';
const recipeShortId = shorten(recipeId);

describe('toRecipe', () => {
  it('maps a full backend recipe, deriving the short id', () => {
    const backend: BackendRecipe = {
      recipeId,
      houseId: 'house-1',
      isPublic: true,
      name: 'Tacos',
      description: 'Tasty tacos',
      sourceUrl: 'https://example.com/tacos',
      steps: ['Brown the beef'],
      ingredients: [{ name: 'Beef', measure: 'GRAMS', amount: 500 }],
      updatedAt: '2026-06-10T12:00:00.000Z',
    };

    expect(toRecipe(backend)).toEqual({
      recipeId,
      recipeShortId,
      houseId: 'house-1',
      isPublic: true,
      name: 'Tacos',
      description: 'Tasty tacos',
      sourceUrl: 'https://example.com/tacos',
      steps: ['Brown the beef'],
      ingredients: [{ name: 'Beef', measure: 'GRAMS', amount: 500 }],
      updatedAt: '2026-06-10T12:00:00.000Z',
    });
  });

  it('defaults missing description, sourceUrl, steps, ingredients, houseId and isPublic', () => {
    const backend: BackendRecipe = {
      recipeId,
      name: 'Tacos',
      description: undefined,
      steps: undefined,
    };

    expect(toRecipe(backend)).toEqual({
      recipeId,
      recipeShortId,
      houseId: null,
      isPublic: false,
      name: 'Tacos',
      description: null,
      sourceUrl: null,
      steps: [],
      ingredients: [],
      updatedAt: undefined,
    });
  });
});
