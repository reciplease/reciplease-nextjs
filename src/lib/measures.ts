export const measureDisplayMap: Record<string, { singular: string; plural: string }> = {
  ITEMS: { singular: 'item', plural: 'items' },
  KILOGRAMS: { singular: 'kilogram', plural: 'kilograms' },
  GRAMS: { singular: 'gram', plural: 'grams' },
  LITRES: { singular: 'litre', plural: 'litres' },
  MILLILITRES: { singular: 'millilitre', plural: 'millilitres' },
};

export function toMeasure(measureId: string): Measure {
  const display = measureDisplayMap[measureId];
  if (!display) throw new Error(`Unknown measure: ${measureId}`);
  return { measureId, ...display };
}

export const allMeasures: Measure[] = Object.entries(measureDisplayMap).map(
  ([measureId, display]) => ({ measureId, ...display }),
);
