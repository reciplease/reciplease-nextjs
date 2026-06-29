import type { RecipeFormIngredient, RecipeFormInitial } from '@/components/RecipeForm';

// Maps text forms of units found in schema.org recipeIngredient strings to the
// app's stable measureIds. Covers BBC Good Food and HelloFresh conventions.
const MEASURE_ALIASES: Record<string, string> = {
  g: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg', kilo: 'kg', kilos: 'kg',
  ml: 'ml', millilitre: 'ml', millilitres: 'ml', milliliter: 'ml', milliliters: 'ml',
  cl: 'cl', centilitre: 'cl', centilitres: 'cl', centiliter: 'cl', centiliters: 'cl',
  l: 'l', litre: 'l', litres: 'l', liter: 'l', liters: 'l',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  item: 'item', items: 'item',
  pc: 'pc', piece: 'pc', pieces: 'pc',
};

// Evaluates numeric strings including fractions ("1/2") and mixed numbers ("1 1/2").
function parseAmount(str: string): number {
  const mixed = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / parseInt(mixed[3], 10);
  const frac = str.match(/^(\d+)\/(\d+)$/);
  if (frac) return parseInt(frac[1], 10) / parseInt(frac[2], 10);
  return parseFloat(str.replace(',', '.')) || 1;
}

// Parses one schema.org recipeIngredient string into a structured ingredient.
// Handles patterns like "200g plain flour", "2 tbsp olive oil", "3 large eggs",
// "1/2 tsp salt", "1 1/2 litres stock", "pinch of salt".
export function parseIngredient(str: string): RecipeFormIngredient {
  const trimmed = str.trim();

  // Match a leading number: integer, decimal (dot or comma), fraction, or mixed number.
  const numMatch = trimmed.match(/^(\d+(?:\s+\d+\/\d+|\.\d+|,\d+|\/\d+)?)\s*/);
  if (!numMatch) {
    return { name: trimmed || 'unknown', measureId: 'item', amount: 1 };
  }

  const amount = parseAmount(numMatch[1]);
  const remainder = trimmed.slice(numMatch[0].length);

  // Try to match a known unit word immediately after the number.
  const unitMatch = remainder.match(/^([a-zA-Z]+)\.?\s*/);
  if (unitMatch) {
    const measureId = MEASURE_ALIASES[unitMatch[1].toLowerCase()];
    if (measureId) {
      const name = remainder.slice(unitMatch[0].length).trim();
      return { name: name || unitMatch[1], measureId, amount };
    }
  }

  // No known unit — everything after the number is the name.
  return { name: remainder.trim() || trimmed, measureId: 'item', amount };
}

export interface SchemaOrgRecipe {
  '@type': string | string[];
  name?: unknown;
  description?: unknown;
  recipeIngredient?: unknown[];
  recipeInstructions?: unknown[];
}

// Recursively finds a schema.org Recipe object in arbitrary JSON-LD.
// Handles both top-level @type layouts (HelloFresh) and @graph-wrapped layouts (BBC Good Food).
export function extractRecipeFromJsonLd(jsonLd: unknown): SchemaOrgRecipe | null {
  if (!jsonLd || typeof jsonLd !== 'object' || Array.isArray(jsonLd)) return null;
  const obj = jsonLd as Record<string, unknown>;

  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) {
      const found = extractRecipeFromJsonLd(item);
      if (found) return found;
    }
    return null;
  }

  const type = obj['@type'];
  if (type === 'Recipe' || (Array.isArray(type) && (type as string[]).includes('Recipe'))) {
    return obj as unknown as SchemaOrgRecipe;
  }

  return null;
}

function extractStepTexts(instructions: unknown[]): string[] {
  const texts: string[] = [];
  for (const item of instructions) {
    if (typeof item === 'string') {
      const t = item.trim();
      if (t) texts.push(t);
    } else if (item && typeof item === 'object') {
      const node = item as Record<string, unknown>;
      if (node['@type'] === 'HowToStep' && typeof node.text === 'string') {
        const t = node.text.trim();
        if (t) texts.push(t);
      } else if (node['@type'] === 'HowToSection' && Array.isArray(node.itemListElement)) {
        // Sectioned recipes (e.g. "For the sauce" / "For the pasta") — flatten steps.
        texts.push(...extractStepTexts(node.itemListElement as unknown[]));
      }
    }
  }
  return texts;
}

// Normalises recipeInstructions to a flat array of items, handling three real-world shapes:
//   - Array of HowToStep / HowToSection / strings (most common)
//   - Single plain string (rare but valid per schema.org)
//   - ItemList object with itemListElement (some sites)
function normalizeInstructions(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') return raw.trim() ? [raw] : [];
  if (raw && typeof raw === 'object') {
    const node = raw as Record<string, unknown>;
    if (Array.isArray(node.itemListElement)) return node.itemListElement as unknown[];
  }
  return [];
}

export function parseImportedRecipe(schema: SchemaOrgRecipe): RecipeFormInitial {
  const steps = extractStepTexts(normalizeInstructions(schema.recipeInstructions));
  const ingredients = (schema.recipeIngredient ?? [])
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map(parseIngredient);

  const name = typeof schema.name === 'string' ? schema.name.trim() : '';
  const description =
    typeof schema.description === 'string' && schema.description.trim()
      ? schema.description.trim()
      : null;

  return { name, description, steps, ingredients, isPublic: false };
}
