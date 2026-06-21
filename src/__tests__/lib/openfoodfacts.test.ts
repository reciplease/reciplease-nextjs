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
      measureId: 'l',
      imageUrl: null,
    });
  });

  it('prefers the small front image over the generic image', async () => {
    mockProduct({
      product_name: 'Oat Milk',
      image_front_small_url: 'https://images.example/front-small.jpg',
      image_url: 'https://images.example/full.jpg',
    });
    expect((await lookupProduct('1')).imageUrl).toBe('https://images.example/front-small.jpg');
  });

  it('falls back to the generic image when no front image is available', async () => {
    mockProduct({ product_name: 'Oat Milk', image_url: 'https://images.example/full.jpg' });
    expect((await lookupProduct('1')).imageUrl).toBe('https://images.example/full.jpg');
  });

  it('returns a null imageUrl when neither image field is available', async () => {
    mockProduct({ product_name: 'Oat Milk' });
    expect((await lookupProduct('1')).imageUrl).toBeNull();
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

  it('handles products with no name, brand or category fields', async () => {
    mockProduct({ generic_name: 'Generic Stuff' });
    expect((await lookupProduct('1')).nameCandidates).toEqual(['Generic Stuff']);
  });

  it('returns empty results when product not found (status 0)', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 0 }),
    });
    expect(await lookupProduct('0')).toEqual({ nameCandidates: [], measureId: null, imageUrl: null });
  });

  it('returns empty results on HTTP error', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false });
    expect(await lookupProduct('bad')).toEqual({ nameCandidates: [], measureId: null, imageUrl: null });
  });

  it('returns empty results on network failure', async () => {
    (fetch as jest.Mock).mockRejectedValue(new Error('timeout'));
    expect(await lookupProduct('bad')).toEqual({ nameCandidates: [], measureId: null, imageUrl: null });
  });
});

describe('measureIdFromQuantity', () => {
  it.each([
    ['500 g', 'g'],
    ['1.5 kg', 'kg'],
    ['250 mg', 'g'],
    ['1 L', 'l'],
    ['330 ml', 'ml'],
    ['33 cl', 'cl'],
    ['5 dl', 'ml'],
  ])('maps %s to %s', (quantity, expected) => {
    expect(measureIdFromQuantity(quantity)).toBe(expected);
  });

  it('uses the last unit when several are present (e.g. multipacks)', () => {
    expect(measureIdFromQuantity('6 x 33 cl')).toBe('cl');
  });

  it('returns null for missing or unrecognised units', () => {
    expect(measureIdFromQuantity('')).toBeNull();
    expect(measureIdFromQuantity('1 sachet')).toBeNull();
    expect(measureIdFromQuantity('a dozen')).toBeNull();
  });
});
