import { toMeasure, allMeasures } from './measures';

describe('toMeasure', () => {
  it('returns correct display names for known measures', () => {
    expect(toMeasure('GRAMS')).toEqual({
      measureId: 'GRAMS',
      singular: 'gram',
      plural: 'grams',
    });
    expect(toMeasure('ITEMS')).toEqual({
      measureId: 'ITEMS',
      singular: 'item',
      plural: 'items',
    });
  });

  it('throws for unknown measure', () => {
    expect(() => toMeasure('SPOONFULS')).toThrow('Unknown measure: SPOONFULS');
  });
});

describe('allMeasures', () => {
  it('contains all backend measures', () => {
    const ids = allMeasures.map((m) => m.measureId);
    expect(ids).toContain('ITEMS');
    expect(ids).toContain('GRAMS');
    expect(ids).toContain('KILOGRAMS');
    expect(ids).toContain('LITRES');
    expect(ids).toContain('MILLILITRES');
  });
});
