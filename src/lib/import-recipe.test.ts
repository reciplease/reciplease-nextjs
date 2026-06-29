import { parseIngredient, extractRecipeFromJsonLd, parseImportedRecipe, type SchemaOrgRecipe } from './import-recipe';

describe('parseIngredient', () => {
  it.each([
    ['200g plain flour', { name: 'plain flour', measureId: 'g', amount: 200 }],
    ['225g softened butter', { name: 'softened butter', measureId: 'g', amount: 225 }],
    ['2 tbsp olive oil', { name: 'olive oil', measureId: 'tbsp', amount: 2 }],
    ['1 tsp baking powder', { name: 'baking powder', measureId: 'tsp', amount: 1 }],
    ['150ml double cream', { name: 'double cream', measureId: 'ml', amount: 150 }],
    ['100 ml whole milk', { name: 'whole milk', measureId: 'ml', amount: 100 }],
    ['1.5 litres chicken stock', { name: 'chicken stock', measureId: 'l', amount: 1.5 }],
    ['50cl white wine', { name: 'white wine', measureId: 'cl', amount: 50 }],
    ['500g pasta', { name: 'pasta', measureId: 'g', amount: 500 }],
    ['30g parmesan', { name: 'parmesan', measureId: 'g', amount: 30 }],
    ['5g fresh thyme', { name: 'fresh thyme', measureId: 'g', amount: 5 }],
  ])('parses "%s"', (input, expected) => {
    expect(parseIngredient(input)).toEqual(expected);
  });

  it('handles no unit — treats whole remainder as name', () => {
    expect(parseIngredient('3 large eggs')).toEqual({ name: 'large eggs', measureId: 'item', amount: 3 });
  });

  it('handles single word name with no unit', () => {
    expect(parseIngredient('1 shallot')).toEqual({ name: 'shallot', measureId: 'item', amount: 1 });
  });

  it('handles comma-separated suffix after unit-less ingredient', () => {
    expect(parseIngredient('1 lemon, zested')).toEqual({ name: 'lemon, zested', measureId: 'item', amount: 1 });
  });

  it('handles comma-separated suffix after measurable ingredient', () => {
    expect(parseIngredient('225g softened butter, plus extra for greasing')).toEqual({
      name: 'softened butter, plus extra for greasing',
      measureId: 'g',
      amount: 225,
    });
  });

  it('handles fractions like 1/2', () => {
    expect(parseIngredient('1/2 tsp salt')).toEqual({ name: 'salt', measureId: 'tsp', amount: 0.5 });
  });

  it('handles mixed numbers like 1 1/2', () => {
    expect(parseIngredient('1 1/2 tbsp soy sauce')).toEqual({ name: 'soy sauce', measureId: 'tbsp', amount: 1.5 });
  });

  it('handles European decimal comma', () => {
    expect(parseIngredient('1,5 litres water')).toEqual({ name: 'water', measureId: 'l', amount: 1.5 });
  });

  it('handles pluralised unit words', () => {
    expect(parseIngredient('2 teaspoons vanilla extract')).toEqual({
      name: 'vanilla extract',
      measureId: 'tsp',
      amount: 2,
    });
    expect(parseIngredient('3 tablespoons honey')).toEqual({ name: 'honey', measureId: 'tbsp', amount: 3 });
  });

  it('falls back gracefully for strings with no leading number', () => {
    expect(parseIngredient('pinch of salt')).toEqual({ name: 'pinch of salt', measureId: 'item', amount: 1 });
    expect(parseIngredient('salt to taste')).toEqual({ name: 'salt to taste', measureId: 'item', amount: 1 });
    expect(parseIngredient('a handful of parsley')).toEqual({ name: 'a handful of parsley', measureId: 'item', amount: 1 });
  });

  it('falls back gracefully for an empty string', () => {
    expect(parseIngredient('')).toEqual({ name: 'unknown', measureId: 'item', amount: 1 });
  });
});

describe('extractRecipeFromJsonLd', () => {
  it('extracts a top-level Recipe object (HelloFresh style)', () => {
    const jsonLd = { '@context': 'http://schema.org', '@type': 'Recipe', name: 'Pasta' };
    expect(extractRecipeFromJsonLd(jsonLd)).toBe(jsonLd);
  });

  it('extracts a Recipe nested inside @graph (BBC Good Food style)', () => {
    const recipe = { '@type': 'Recipe', name: 'Cake' };
    const jsonLd = { '@context': 'https://schema.org', '@graph': [{ '@type': 'WebPage' }, recipe] };
    expect(extractRecipeFromJsonLd(jsonLd)).toBe(recipe);
  });

  it('handles @type as an array containing "Recipe"', () => {
    const jsonLd = { '@type': ['Thing', 'Recipe'], name: 'Soup' };
    expect(extractRecipeFromJsonLd(jsonLd)).toBe(jsonLd);
  });

  it('returns null when @graph contains no Recipe', () => {
    const jsonLd = { '@graph': [{ '@type': 'WebPage' }, { '@type': 'BreadcrumbList' }] };
    expect(extractRecipeFromJsonLd(jsonLd)).toBeNull();
  });

  it('returns null for non-Recipe top-level objects', () => {
    expect(extractRecipeFromJsonLd({ '@type': 'WebPage' })).toBeNull();
  });

  it('returns null for null, arrays, and primitives', () => {
    expect(extractRecipeFromJsonLd(null)).toBeNull();
    expect(extractRecipeFromJsonLd([])).toBeNull();
    expect(extractRecipeFromJsonLd('Recipe')).toBeNull();
    expect(extractRecipeFromJsonLd(42)).toBeNull();
  });
});

describe('parseImportedRecipe', () => {
  const baseSchema: SchemaOrgRecipe = {
    '@type': 'Recipe',
    name: 'Lemon drizzle cake',
    description: 'A wonderfully moist British classic.',
    recipeIngredient: ['225g butter', '2 tbsp milk', '4 large eggs'],
    recipeInstructions: [
      { '@type': 'HowToStep', text: 'Preheat the oven to 180C.' },
      { '@type': 'HowToStep', text: 'Cream the butter and sugar.' },
    ],
  };

  it('maps name, description, steps, and ingredients', () => {
    const result = parseImportedRecipe(baseSchema);
    expect(result.name).toBe('Lemon drizzle cake');
    expect(result.description).toBe('A wonderfully moist British classic.');
    expect(result.steps).toEqual(['Preheat the oven to 180C.', 'Cream the butter and sugar.']);
    expect(result.ingredients).toHaveLength(3);
    expect(result.isPublic).toBe(false);
  });

  it('parses HowToStep instruction objects', () => {
    const result = parseImportedRecipe(baseSchema);
    expect(result.steps[0]).toBe('Preheat the oven to 180C.');
  });

  it('parses plain string instructions (some HelloFresh recipes)', () => {
    const schema: SchemaOrgRecipe = {
      '@type': 'Recipe',
      name: 'Simple Pasta',
      recipeInstructions: ['Boil water.', 'Cook pasta.', 'Drain and serve.'],
    };
    expect(parseImportedRecipe(schema).steps).toEqual(['Boil water.', 'Cook pasta.', 'Drain and serve.']);
  });

  it('flattens HowToSection instruction groups', () => {
    const schema: SchemaOrgRecipe = {
      '@type': 'Recipe',
      name: 'Layered recipe',
      recipeInstructions: [
        {
          '@type': 'HowToSection',
          name: 'Make the sauce',
          itemListElement: [
            { '@type': 'HowToStep', text: 'Melt butter.' },
            { '@type': 'HowToStep', text: 'Add flour.' },
          ],
        },
        { '@type': 'HowToStep', text: 'Combine everything.' },
      ],
    };
    expect(parseImportedRecipe(schema).steps).toEqual(['Melt butter.', 'Add flour.', 'Combine everything.']);
  });

  it('returns null description when field is absent', () => {
    const schema: SchemaOrgRecipe = { '@type': 'Recipe', name: 'Quick soup' };
    expect(parseImportedRecipe(schema).description).toBeNull();
  });

  it('returns null description when field is an empty string', () => {
    const schema: SchemaOrgRecipe = { '@type': 'Recipe', name: 'Quick soup', description: '   ' };
    expect(parseImportedRecipe(schema).description).toBeNull();
  });

  it('returns empty steps when recipeInstructions is absent', () => {
    const schema: SchemaOrgRecipe = { '@type': 'Recipe', name: 'Test' };
    expect(parseImportedRecipe(schema).steps).toEqual([]);
  });

  it('returns empty ingredients when recipeIngredient is absent', () => {
    const schema: SchemaOrgRecipe = { '@type': 'Recipe', name: 'Test' };
    expect(parseImportedRecipe(schema).ingredients).toEqual([]);
  });

  it('filters out blank ingredient strings', () => {
    const schema: SchemaOrgRecipe = {
      '@type': 'Recipe',
      name: 'Test',
      recipeIngredient: ['100g flour', '', '  ', '2 eggs'],
    };
    expect(parseImportedRecipe(schema).ingredients).toHaveLength(2);
  });

  it('trims whitespace from name', () => {
    const schema: SchemaOrgRecipe = { '@type': 'Recipe', name: '  Soup  ' };
    expect(parseImportedRecipe(schema).name).toBe('Soup');
  });

  it('always sets isPublic to false regardless of schema', () => {
    expect(parseImportedRecipe(baseSchema).isPublic).toBe(false);
  });

  it('handles recipeInstructions as a single plain string (one step)', () => {
    const schema: SchemaOrgRecipe = {
      '@type': 'Recipe',
      name: 'Vinaigrette',
      recipeInstructions: 'Whisk all ingredients together.' as unknown as unknown[],
    };
    expect(parseImportedRecipe(schema).steps).toEqual(['Whisk all ingredients together.']);
  });

  it('handles recipeInstructions as an ItemList object', () => {
    const schema: SchemaOrgRecipe = {
      '@type': 'Recipe',
      name: 'Test',
      recipeInstructions: {
        '@type': 'ItemList',
        itemListElement: [
          { '@type': 'HowToStep', text: 'Step one.' },
          { '@type': 'HowToStep', text: 'Step two.' },
        ],
      } as unknown as unknown[],
    };
    expect(parseImportedRecipe(schema).steps).toEqual(['Step one.', 'Step two.']);
  });

  it('handles @type as an array containing Recipe', () => {
    const schema = { '@type': ['Recipe', 'Thing'], name: 'Stew' } as SchemaOrgRecipe;
    expect(extractRecipeFromJsonLd(schema)).toBe(schema);
  });
});
