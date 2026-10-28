/** @jest-environment node */
import { toRecipe, type BackendRecipe } from '@/lib/recipes';
import { shorten } from '@/lib/recipe-id';

const recipeId = '5f1d8a2b3c4d5e6f70819203';
const recipeShortId = shorten(recipeId);

describe('toRecipe', () => {
  it('maps a full owned backend recipe, deriving the short id', () => {
    const backend: BackendRecipe = {
      recipeId,
      isPublic: true,
      name: 'Tacos',
      description: 'Tasty tacos',
      sourceUrl: 'https://example.com/tacos',
      method: { steps: ['Brown the beef'] },
      ingredients: [{ name: 'Beef', measure: 'GRAMS', amount: 500 }],
      ownership: { createdBy: { userId: 'user-1', handle: 'alice' }, updatedBy: { userId: 'user-2', handle: 'bob' } },
      updatedAt: '2026-06-10T12:00:00.000Z',
      upvoteCount: 0,
      upvotedByCurrentUser: false,
    };

    expect(toRecipe(backend)).toEqual({
      recipeId,
      recipeShortId,
      isPublic: true,
      name: 'Tacos',
      description: 'Tasty tacos',
      sourceUrl: 'https://example.com/tacos',
      method: { steps: ['Brown the beef'] },
      ingredients: [{ name: 'Beef', measure: 'GRAMS', amount: 500 }],
      ownership: { createdBy: { userId: 'user-1', handle: 'alice' }, updatedBy: { userId: 'user-2', handle: 'bob' } },
      updatedAt: '2026-06-10T12:00:00.000Z',
      upvoteCount: 0,
      upvotedByCurrentUser: false,
    });
  });

  it('passes a table method through untouched', () => {
    const cells = [{ text: 'toast', inputs: [{ text: 'bread', inputs: [] }] }];
    const backend: BackendRecipe = {
      recipeId,
      isPublic: false,
      name: 'Toast',
      description: '',
      sourceUrl: '',
      method: { cells },
      ingredients: [],
      updatedAt: '2026-06-10T12:00:00.000Z',
      upvoteCount: 0,
      upvotedByCurrentUser: false,
    };

    expect(toRecipe(backend).method).toEqual({ cells });
  });

  it('maps a public backend recipe with no owner info', () => {
    const backend: BackendRecipe = {
      recipeId,
      isPublic: false,
      name: 'Tacos',
      description: '',
      sourceUrl: '',
      method: { steps: [] },
      ingredients: [],
      updatedAt: '2026-06-10T12:00:00.000Z',
      upvoteCount: 0,
      upvotedByCurrentUser: false,
    };

    expect(toRecipe(backend)).toEqual({
      recipeId,
      recipeShortId,
      isPublic: false,
      name: 'Tacos',
      description: '',
      sourceUrl: '',
      method: { steps: [] },
      ingredients: [],
      updatedAt: '2026-06-10T12:00:00.000Z',
      upvoteCount: 0,
      upvotedByCurrentUser: false,
    });
  });
});
