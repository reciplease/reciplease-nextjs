import { ingredientRowText } from '@/lib/ingredient-row-text';

const measures: Measure[] = [
  { measureId: 'GRAMS', singular: 'gram', plural: 'grams', short: 'g' },
  { measureId: 'ITEMS', singular: 'item', plural: 'items', short: 'item' },
  { measureId: 'PIECES', singular: 'piece', plural: 'pieces', short: 'pc' },
];

describe('ingredientRowText', () => {
  it('puts the amount and short measure before the name', () => {
    expect(ingredientRowText({ name: 'flour', measureId: 'GRAMS', amount: 200 }, measures)).toBe('200 g flour');
  });

  it('leaves out the unit for items', () => {
    expect(ingredientRowText({ name: 'eggs', measureId: 'ITEMS', amount: 3 }, measures)).toBe('3 eggs');
  });

  it('leaves out the unit for pieces', () => {
    expect(ingredientRowText({ name: 'rolls', measureId: 'PIECES', amount: 2 }, measures)).toBe('2 rolls');
  });

  it('leaves out the unit when the measure is unknown', () => {
    expect(ingredientRowText({ name: 'salt', measureId: 'PINCH', amount: 1 }, measures)).toBe('1 salt');
  });

  it('trims the name', () => {
    expect(ingredientRowText({ name: '  flour ', measureId: 'GRAMS', amount: 5 }, measures)).toBe('5 g flour');
  });
});
