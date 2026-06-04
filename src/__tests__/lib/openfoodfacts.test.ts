import { lookupBarcode } from '@/lib/openfoodfacts';

global.fetch = jest.fn();

describe('lookupBarcode', () => {
  beforeEach(() => (fetch as jest.Mock).mockReset());

  it('returns product name and brands on success', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 1,
        product: { product_name: 'Oat Milk', brands: 'Oatly' },
      }),
    });

    const result = await lookupBarcode('1234567890123');
    expect(result).toEqual({ productName: 'Oat Milk', brands: 'Oatly' });
  });

  it('returns null when product not found (status 0)', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 0 }),
    });

    expect(await lookupBarcode('0000000000000')).toBeNull();
  });

  it('returns null on HTTP error', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false });
    expect(await lookupBarcode('bad')).toBeNull();
  });

  it('returns null on network failure', async () => {
    (fetch as jest.Mock).mockRejectedValue(new Error('timeout'));
    expect(await lookupBarcode('bad')).toBeNull();
  });
});
