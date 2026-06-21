/** @jest-environment node */
import { GET } from '@/app/api/inventory/[uuid]/route';

jest.mock('@/lib/backend', () => ({ backendFetch: jest.fn() }));

const { backendFetch } = require('@/lib/backend');

const grams: Measure = { measureId: 'GRAMS', singular: 'gram', plural: 'grams', short: 'g' };

function mockBackend(measureResponse: unknown, itemResponse: unknown) {
  (backendFetch as jest.Mock).mockImplementation((path: string) => {
    if (path === '/api/measures/GRAMS') return Promise.resolve(measureResponse);
    return Promise.resolve(itemResponse);
  });
}

describe('GET /api/inventory/[uuid]', () => {
  afterEach(() => (backendFetch as jest.Mock).mockReset());

  it('returns the item mapped from the backend, including barcode and updatedAt when present', async () => {
    mockBackend(
      { ok: true, json: async () => grams },
      {
        ok: true,
        status: 200,
        json: async () => ({
          uuid: 'item-1',
          name: 'Milk',
          measure: 'GRAMS',
          amount: 500,
          expiration: '2026-07-01',
          barcode: '12345',
          updatedAt: '2026-06-10T12:00:00.000Z',
        }),
      },
    );

    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ uuid: 'item-1' }) });

    expect(backendFetch).toHaveBeenCalledWith('/api/inventory/item-1');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      uuid: 'item-1',
      name: 'Milk',
      measure: grams,
      amount: 500,
      expiration: '2026-07-01',
      barcode: '12345',
      updatedAt: '2026-06-10T12:00:00.000Z',
    });
  });

  it('omits barcode and updatedAt when not present', async () => {
    mockBackend(
      { ok: true, json: async () => grams },
      {
        ok: true,
        status: 200,
        json: async () => ({ uuid: 'item-2', name: 'Eggs', measure: 'GRAMS', amount: 6, expiration: '2026-07-05' }),
      },
    );

    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ uuid: 'item-2' }) });

    expect(await response.json()).toEqual({
      uuid: 'item-2',
      name: 'Eggs',
      measure: grams,
      amount: 6,
      expiration: '2026-07-05',
    });
  });

  it('returns 404 when the backend reports not found', async () => {
    (backendFetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });

    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ uuid: 'missing' }) });

    expect(response.status).toBe(404);
  });

  it('proxies other backend error statuses', async () => {
    (backendFetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ uuid: 'item-1' }) });

    expect(response.status).toBe(500);
  });
});
