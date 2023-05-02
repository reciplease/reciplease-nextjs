const measuresInternal: Measure[] = [
  {
    measureId: 'ITEMS',
    singular: 'item',
    plural: 'items',
  },
  {
    measureId: 'GRAMS',
    singular: 'gram',
    plural: 'grams',
  },
];

export const measures = measuresInternal;

export function findMeasure(measureId: MeasureId) {
  return (
    measures.find((measure) => measure.measureId === measureId) ??
    (() => {
      throw new Error(`Could not find measure for '${measureId}'`);
    })()
  );
}
