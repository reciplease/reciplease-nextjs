import { lookupProduct, measureIdFromQuantity } from '@/lib/openfoodfacts';

global.fetch = jest.fn();

function mockProduct(product: Record<string, string>) {
  (fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ status: 1, product }),
  });
}

describe('lookupProduct', () => {
  beforeEach(() => (fetch as jest.Mock).mockReset());

  it('derives distinct, best-first name candidates and a measure', async () => {
    mockProduct({
      product_name: 'Oat Milk',
      generic_name: 'Oat drink',
      abbreviated_product_name: 'Oat M.',
      brands: 'Oatly, Subbrand',
      quantity: '1 L',
      categories: 'Beverages, Plant-based milks',
    });

    expect(await lookupProduct('1234567890123')).toEqual({
      nameCandidates: [
        'Oat Milk',
        'Oatly Oat Milk',
        'Oat drink',
        'Oat M.',
        'Plant-based milks',
      ],
      measureId: 'LITRES',
    });
  });

  it('does not include the quantity in name candidates', async () => {
    mockProduct({ product_name: 'Cola', quantity: '33 cl' });
    const { nameCandidates } = await lookupProduct('1');
    expect(nameCandidates).toEqual(['Cola']);
  });

  it('drops blank fields and de-duplicates', async () => {
    mockProduct({ product_name: 'Salt', generic_name: 'Salt' });
    expect((await lookupProduct('1')).nameCandidates).toEqual(['Salt']);
  });

  it('returns empty results when product not found (status 0)', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 0 }),
    });
    expect(await lookupProduct('0')).toEqual({ nameCandidates: [], measureId: null });
  });

  it('returns empty results on HTTP error', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false });
    expect(await lookupProduct('bad')).toEqual({ nameCandidates: [], measureId: null });
  });

  it('returns empty results on network failure', async () => {
    (fetch as jest.Mock).mockRejectedValue(new Error('timeout'));
    expect(await lookupProduct('bad')).toEqual({ nameCandidates: [], measureId: null });
  });
});

describe('measureIdFromQuantity', () => {
  it.each([
    ['500 g', 'GRAMS'],
    ['1.5 kg', 'KILOGRAMS'],
    ['250 mg', 'GRAMS'],
    ['1 L', 'LITRES'],
    ['330 ml', 'MILLILITRES'],
    ['33 cl', 'MILLILITRES'],
    ['5 dl', 'MILLILITRES'],
  ])('maps %s to %s', (quantity, expected) => {
    expect(measureIdFromQuantity(quantity)).toBe(expected);
  });

  it('uses the last unit when several are present (e.g. multipacks)', () => {
    expect(measureIdFromQuantity('6 x 33 cl')).toBe('MILLILITRES');
  });

  it('returns null for missing or unrecognised units', () => {
    expect(measureIdFromQuantity('')).toBeNull();
    expect(measureIdFromQuantity('1 sachet')).toBeNull();
    expect(measureIdFromQuantity('a dozen')).toBeNull();
  });
});
