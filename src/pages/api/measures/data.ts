export const measures: Measure[] = [
  {
    measureId: 'ITEMS',
    singular: 'item',
    plural: 'items',
  },
  {
    measureId: 'KILOGRAMS',
    singular: 'kilogram',
    plural: 'kilograms',
  },
  {
    measureId: 'GRAMS',
    singular: 'gram',
    plural: 'grams',
  },
  {
    measureId: 'LITRES',
    singular: 'litres',
    plural: 'litre',
  },
  {
    measureId: 'MILLILITRES',
    singular: 'millilitre',
    plural: 'millilitres',
  },
];

export function findMeasure(measureId: MeasureId) {
  return (
    measures.find((measure) => measure.measureId === measureId) ??
    (() => {
      throw new Error(`Could not find measure for '${measureId}'`);
    })()
  );
}
