import type { RecipeFormIngredient, RecipeFormInitial } from '@/components/RecipeForm';

// Maps text forms of units found in schema.org recipeIngredient strings to the
// app's stable measureIds. Covers BBC Good Food and HelloFresh conventions.
// Units the app doesn't support (oz, cup, lb) map to 'item' so their word is
// still stripped from the ingredient name rather than left in it.
const MEASURE_ALIASES: Record<string, string> = {
  g: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg', kilo: 'kg', kilos: 'kg',
  ml: 'ml', millilitre: 'ml', millilitres: 'ml', milliliter: 'ml', milliliters: 'ml',
  cl: 'cl', centilitre: 'cl', centilitres: 'cl', centiliter: 'cl', centiliters: 'cl',
  l: 'l', litre: 'l', litres: 'l', liter: 'l', liters: 'l',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  item: 'item', items: 'item', unit: 'item', units: 'item',
  pc: 'pc', piece: 'pc', pieces: 'pc',
  // HelloFresh US units, now supported as first-class measures in the backend.
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  cup: 'cup', cups: 'cup',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  floz: 'oz',
};

// Common Unicode vulgar fractions used in recipe quantities.
const UNICODE_FRACTIONS: Record<string, string> = {
  '½': '1/2', '⅓': '1/3', '⅔': '2/3',
  '¼': '1/4', '¾': '3/4',
  '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8',
  '⅙': '1/6', '⅚': '5/6',
};

// Replaces Unicode fraction characters with their ASCII equivalents, inserting
// a space between a preceding digit and the fraction ("1½" → "1 1/2").
function normalizeFractions(str: string): string {
  let result = str;
  for (const [char, ascii] of Object.entries(UNICODE_FRACTIONS)) {
    result = result.replace(new RegExp(`(\\d)${char}`, 'g'), `$1 ${ascii}`);
    result = result.replace(new RegExp(char, 'g'), ascii);
  }
  return result;
}

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
// "1/2 tsp salt", "1 1/2 litres stock", "¼ cup cream", "pinch of salt".
export function parseIngredient(str: string): RecipeFormIngredient {
  const normalized = normalizeFractions(str.trim());

  // Match a leading number: integer, decimal (dot or comma), fraction, or mixed number.
  const numMatch = normalized.match(/^(\d+(?:\s+\d+\/\d+|\.\d+|,\d+|\/\d+)?)\s*/);
  if (!numMatch) {
    return { name: normalized.toLowerCase() || 'unknown', measureId: 'item', amount: 1 };
  }

  const amount = parseAmount(numMatch[1]);
  const remainder = normalized.slice(numMatch[0].length);

  // Try to match a known unit word immediately after the number.
  // Handle optional "(s)" suffix used by some sites ("1 unit(s) Lemon").
  const unitMatch = remainder.match(/^([a-zA-Z]+)(?:\([^)]*\))?\.?\s*/);
  if (unitMatch) {
    const measureId = MEASURE_ALIASES[unitMatch[1].toLowerCase()];
    if (measureId) {
      const name = remainder.slice(unitMatch[0].length).trim().toLowerCase();
      return { name: name || unitMatch[1].toLowerCase(), measureId, amount };
    }
  }

  // No known unit — everything after the number is the name.
  // Only record originalUnit when the unrecognised word is followed by a space and more text
  // (i.e. it was acting as a unit/modifier like "cloves garlic", not "shallot" or "lemon, zested").
  const nameAfterWord = unitMatch ? remainder.slice(unitMatch[0].length).trim() : '';
  const originalUnit = unitMatch && /^[a-zA-Z]/.test(nameAfterWord) ? unitMatch[1].toLowerCase() : undefined;
  return { name: remainder.trim().toLowerCase() || normalized.toLowerCase(), measureId: 'item', amount, ...(originalUnit ? { originalUnit } : {}) };
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

// Cleans one raw step string:
// - Splits on newline + bullet (HelloFresh packs multiple sub-steps into one block)
// - Strips leading bullets and ***footnote*** markers
// - Collapses soft-wrapped newlines to spaces
function cleanStepText(raw: string): string[] {
  return raw
    .split(/\n\s*•/)
    .map((part) =>
      part
        .replace(/^[•]\s*/, '')
        .replace(/\*{2,}([^*]+)\*{2,}/g, '$1')
        .replace(/\n/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim(),
    )
    .filter(Boolean);
}

function extractStepTexts(instructions: unknown[]): string[] {
  const texts: string[] = [];
  for (const item of instructions) {
    if (typeof item === 'string') {
      texts.push(...cleanStepText(item));
    } else if (item && typeof item === 'object') {
      const node = item as Record<string, unknown>;
      if (node['@type'] === 'HowToStep' && typeof node.text === 'string') {
        texts.push(...cleanStepText(node.text));
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
