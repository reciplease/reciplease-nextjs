/** @jest-environment node */
import { toPlannedMeal, type BackendPlannedMeal } from '@/lib/plannedMeals';
import { shorten } from '@/lib/recipe-id';

const plannedMealId = '5f1d8a2b3c4d5e6f70819204';
const recipeId = '5f1d8a2b3c4d5e6f70819203';

const basePlannedMeal: BackendPlannedMeal = {
  plannedMealId,
  houseId: 'house-1',
  name: 'Dinner',
  date: '2026-10-28',
  items: [],
  eatenAt: '2026-10-28T19:00:00.000Z',
};

describe('toPlannedMeal', () => {
  it('derives the planned meal short id', () => {
    expect(toPlannedMeal(basePlannedMeal)).toEqual({
      ...basePlannedMeal,
      plannedMealShortId: shorten(plannedMealId),
      recipe: undefined,
    });
  });

  it('maps the embedded recipe, deriving its short id and keeping its ownership', () => {
    const ownership = { createdBy: { userId: 'user-1', handle: 'alice' } };
    const meal = toPlannedMeal({
      ...basePlannedMeal,
      recipe: {
        recipeId,
        isPublic: false,
        name: 'Tacos',
        description: '',
        sourceUrl: '',
        method: { steps: [] },
        ingredients: [],
        ownership,
        updatedAt: '2026-10-28T12:00:00.000Z',
        upvoteCount: 0,
        upvotedByCurrentUser: false,
      },
    });

    expect(meal.recipe).toMatchObject({ recipeShortId: shorten(recipeId), ownership });
  });
});
