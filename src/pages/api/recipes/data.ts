import { findMeasure } from '@/pages/api/measures/data';

import short from 'short-uuid';

const translator = short();

export function shorten(long: RecipeId): string {
  return translator.fromUUID(long);
}

export function full(short: RecipeShortId): string {
  return translator.toUUID(short);
}

const recipesInternal: Omit<Recipe, 'recipeShortId'>[] = [
  {
    recipeId: 'dbdc02be-a311-4aee-b974-c88d3c61f51b',
    name: 'Toast',
    description: 'A staple and classic',
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
    steps: [
      'Toast the bread',
      'Optionally: Wait for toast to cool down',
      'Spread butter on toast',
    ],
  },
  {
    recipeId: '1ccbef91-02f0-48d4-8d5b-316c5b3cdf38',
    name: 'Yimmy Pork Belly',
    description: 'Chinese-style BBQ pork belly',
    ingredients: [
      {
        ingredientId: '419f19d0-8b21-4cf6-99ca-3e1601fdee2d',
        name: 'pork belly',
        measure: findMeasure('PIECES'),
        amount: 10,
      },
      {
        ingredientId: '9d8b5b5f-6c0d-4564-97ab-d49a1b0068dd',
        name: 'soy sauce',
        measure: findMeasure('tbsp'),
        amount: 12,
      },
      {
        ingredientId: '39dcbb75-d122-4421-a95b-b2408d0fe257',
        name: 'shaoxin rice wine',
        measure: findMeasure('tsp'),
        amount: 2,
      },
      {
        ingredientId: 'f3587c0f-fc92-4063-a997-0dde308eb8fb',
        name: 'honey',
        measure: findMeasure('tbsp'),
        amount: 5,
      },
      {
        ingredientId: 'ce60e1e0-291d-4ed6-9264-bff409218486',
        name: 'pepper',
        measure: findMeasure('tsp'),
        amount: 1,
      },
      {
        ingredientId: 'fa4c8652-fd81-45f5-9f4b-ed94e22d7eb7',
        name: 'sesame oil',
        measure: findMeasure('tbsp'),
        amount: 2,
      },
      {
        ingredientId: 'd7f568bf-c530-4337-9c6d-7f025b518c66',
        name: 'crispy chilli oil',
        measure: findMeasure('tsp'),
        amount: 2,
      },
    ],
    steps: [
      'Mix all ingredients except pork belly in a mixing bowl',
      'Add pork belly to marinade',
      'Cover top with cling film so that cling film is in contact with meat/marinade',
      'Leave to marinade for at least 1 hour and ideally overnight in the fridge',
      'Place pork belly on a medium heat charcoal grill with the meat side down',
      'Cook until the first side looks charred and slightly black',
      'Turn and repeat for each side',
      'Once all sides are done (approx 1 min per side) meat should be semi soft to touch (similar to a medium steak)',
      'Let rest on cool side of grill for at least as long as cooking time',
      'Optionally: Brush extra honey onto pork belly as it is cooking, this will blacken the pork quickly and give a more crispy exterior',
    ],
  },
];

export const recipes: Recipe[] = recipesInternal.map((recipe) => ({
  ...recipe,
  recipeShortId: shorten(recipe.recipeId),
}));
