import { shorten } from '@/pages/api/short-uuid';
import { findMeasure } from '@/pages/api/measures/data';

const recipesInternal: Omit<Recipe, 'recipeShortId'>[] = [
  {
    recipeId: 'dbdc02be-a311-4aee-b974-c88d3c61f51b',
    name: 'Toast',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Blanditiis commodi dolore dolorem dolores eveniet facilis fugit, libero magnam maxime nesciunt nisi non nostrum perferendis placeat ratione rerum sunt vero voluptatem!',
    ingredients: [
      {
        ingredientId: 'c2dc1ad1-f6f9-467a-a0f3-51a5ca6406df',
        name: 'bread',
        measure: findMeasure('ITEMS'),
        amount: 1,
      },
      {
        ingredientId: '1363607e-c4c3-41a1-a475-feb138a69196',
        name: 'butter',
        measure: findMeasure('GRAMS'),
        amount: 15,
      },
    ],
  },
];

export const recipes: Recipe[] = recipesInternal.map((recipe) => ({
  ...recipe,
  recipeShortId: shorten(recipe.recipeId),
}));
