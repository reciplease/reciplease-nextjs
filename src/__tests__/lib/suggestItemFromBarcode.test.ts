import { suggestItemFromBarcode } from '@/lib/suggestItemFromBarcode';
import { lookupProduct } from '@/lib/openfoodfacts';

jest.mock('@/lib/openfoodfacts', () => ({ lookupProduct: jest.fn() }));

// The generated client (src/types/generated/client.ts) calls this mutator
// directly rather than `fetch` — mocking it here keeps the generated request
// building/response envelope handling exercised for real, while giving the
// tests a single, low-level seam to assert against (same role `global.fetch`
// played before this module migrated off a hand-written apiFetch call).
const mockApiClientMutator = jest.fn();
jest.mock('@/lib/apiClientMutator', () => ({
  apiClientMutator: (...args: unknown[]) => mockApiClientMutator(...args),
  isSuccessResponse: (response: { status: number }) => response.status >= 200 && response.status < 300,
  describeErrorStatus: (status: number) => {
    if (status === 401) return 'Please sign in again.';
    if (status === 403) return "You don't have permission to do that.";
    if (status === 404) return "That couldn't be found.";
    if (status >= 400 && status < 500) return 'Please check your input and try again.';
    return 'Something went wrong. Please try again.';
  },
}));

const BARCODE = '5012345678900';

describe('suggestItemFromBarcode', () => {
  beforeEach(() => {
    mockApiClientMutator.mockReset();
    (lookupProduct as jest.Mock).mockReset();
  });

  it('suggests from a prior pantry item with the same barcode', async () => {
    mockApiClientMutator.mockResolvedValue({
      data: [
        { uuid: '1', name: 'Whole milk', brand: 'Arla', measure: 'ml', amount: 1000, remaining: 500, expiration: '2026-08-01', barcode: BARCODE },
      ],
      status: 200,
      headers: new Headers(),
    });

    const suggestion = await suggestItemFromBarcode(BARCODE);

    expect(suggestion).toEqual({
      name: 'Whole milk',
      brand: 'Arla',
      measureId: 'ml',
      source: 'pantry',
      candidates: [],
      brandCandidates: [],
      imageUrl: null,
    });
    expect(lookupProduct).not.toHaveBeenCalled();
  });

  it('defaults brand to an empty string when the prior pantry item has none', async () => {
    mockApiClientMutator.mockResolvedValue({
      data: [
        { uuid: '1', name: 'Whole milk', measure: 'ml', amount: 1000, remaining: 500, expiration: '2026-08-01', barcode: BARCODE },
      ],
      status: 200,
      headers: new Headers(),
    });

    const suggestion = await suggestItemFromBarcode(BARCODE);

    expect(suggestion.brand).toBe('');
  });

  it('falls back to OpenFoodFacts when no prior item matches', async () => {
    mockApiClientMutator.mockResolvedValue({ data: [], status: 200, headers: new Headers() });
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

  it('falls back to OpenFoodFacts when the pantry lookup fails', async () => {
    mockApiClientMutator.mockRejectedValue(new Error('network'));
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
    mockApiClientMutator.mockResolvedValue({ data: [], status: 200, headers: new Headers() });
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
