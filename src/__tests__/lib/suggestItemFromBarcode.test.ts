import { suggestItemFromBarcode } from '@/lib/suggestItemFromBarcode';
import { lookupProduct } from '@/lib/openfoodfacts';

jest.mock('@/lib/openfoodfacts', () => ({ lookupProduct: jest.fn() }));

global.fetch = jest.fn();

const BARCODE = '5012345678900';

describe('suggestItemFromBarcode', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
    (lookupProduct as jest.Mock).mockReset();
  });

  it('suggests from a prior inventory item with the same barcode', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [
        { uuid: '1', name: 'Whole milk', brand: 'Arla', measure: 'ml', amount: 1000, remaining: 500, expiration: '2026-08-01', barcode: BARCODE },
      ],
    });

    const suggestion = await suggestItemFromBarcode(BARCODE);

    expect(suggestion).toEqual({
      name: 'Whole milk',
      brand: 'Arla',
      measureId: 'ml',
      source: 'inventory',
      candidates: [],
      brandCandidates: [],
      imageUrl: null,
    });
    expect(lookupProduct).not.toHaveBeenCalled();
  });

  it('defaults brand to an empty string when the prior inventory item has none', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [
        { uuid: '1', name: 'Whole milk', measure: 'ml', amount: 1000, remaining: 500, expiration: '2026-08-01', barcode: BARCODE },
      ],
    });

    const suggestion = await suggestItemFromBarcode(BARCODE);

    expect(suggestion.brand).toBe('');
  });

  it('falls back to OpenFoodFacts when no prior item matches', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] });
    (lookupProduct as jest.Mock).mockResolvedValue({
      nameCandidates: ['Semi-skimmed milk', 'Milk'],
      brandCandidates: ['Arla', 'Cravendale'],
      measureId: 'cl',
      imageUrl: 'https://images.example/milk.jpg',
    });

    const suggestion = await suggestItemFromBarcode(BARCODE);

    expect(suggestion).toEqual({
      name: 'Semi-skimmed milk',
      brand: 'Arla',
      measureId: 'cl',
      source: 'openfoodfacts',
      candidates: ['Semi-skimmed milk', 'Milk'],
      brandCandidates: ['Arla', 'Cravendale'],
      imageUrl: 'https://images.example/milk.jpg',
    });
  });

  it('falls back to OpenFoodFacts when the inventory lookup fails', async () => {
    (fetch as jest.Mock).mockRejectedValue(new Error('network'));
    (lookupProduct as jest.Mock).mockResolvedValue({
      nameCandidates: ['Milk'],
      brandCandidates: [],
      measureId: null,
      imageUrl: null,
    });

    const suggestion = await suggestItemFromBarcode(BARCODE);

    expect(suggestion.name).toBe('Milk');
    expect(suggestion.source).toBe('openfoodfacts');
  });

  it('returns an empty suggestion when nothing matches anywhere', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] });
    (lookupProduct as jest.Mock).mockResolvedValue({
      nameCandidates: [],
      brandCandidates: [],
      measureId: null,
      imageUrl: null,
    });

    const suggestion = await suggestItemFromBarcode(BARCODE);

    expect(suggestion).toEqual({
      name: '',
      brand: '',
      measureId: null,
      source: null,
      candidates: [],
      brandCandidates: [],
      imageUrl: null,
    });
  });
});
