/** @jest-environment node */
import { GET, POST } from '@/app/api/inventory/route';

jest.mock('@/lib/backend', () => ({ backendFetch: jest.fn() }));

const { backendFetch } = require('@/lib/backend');

const grams: Measure = { measureId: 'GRAMS', singular: 'gram', plural: 'grams', short: 'g' };

function mockBackend(measuresResponse: unknown, inventoryResponse: unknown) {
  (backendFetch as jest.Mock).mockImplementation((path: string) => {
    if (path === '/api/measures') return Promise.resolve(measuresResponse);
    return Promise.resolve(inventoryResponse);
  });
}

describe('GET /api/inventory', () => {
  afterEach(() => (backendFetch as jest.Mock).mockReset());

  it('returns inventory items mapped from the backend, including barcode when present', async () => {
    mockBackend(
      { ok: true, json: async () => [grams] },
      {
        ok: true,
        json: async () => [
          { uuid: 'item-1', name: 'Milk', measure: 'GRAMS', amount: 500, expiration: '2026-07-01', barcode: '12345' },
          { uuid: 'item-2', name: 'Eggs', measure: 'GRAMS', amount: 6, expiration: '2026-07-05' },
        ],
      },
    );

    const response = await GET();

    expect(backendFetch).toHaveBeenCalledWith('/api/inventory');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      { uuid: 'item-1', name: 'Milk', measure: grams, amount: 500, expiration: '2026-07-01', barcode: '12345' },
      { uuid: 'item-2', name: 'Eggs', measure: grams, amount: 6, expiration: '2026-07-05' },
    ]);
  });

  it('proxies the backend error status', async () => {
    (backendFetch as jest.Mock).mockResolvedValue({ ok: false, status: 502 });

    const response = await GET();

    expect(response.status).toBe(502);
  });
});

describe('POST /api/inventory', () => {
  afterEach(() => (backendFetch as jest.Mock).mockReset());

  it('creates an inventory item with a barcode and returns it mapped', async () => {
    mockBackend(
      { ok: true, json: async () => [grams] },
      {
        ok: true,
        json: async () => ({ uuid: 'item-1', name: 'Milk', measure: 'GRAMS', amount: 500, expiration: '2026-07-01', barcode: '12345' }),
      },
    );

    const create: CreateInventoryItem = { name: 'Milk', measureId: 'GRAMS', amount: 500, expiration: '2026-07-01', barcode: '12345' };
    const request = new Request('http://localhost/api/inventory', {
      method: 'POST',
      body: JSON.stringify(create),
    });
    const response = await POST(request);

    expect(backendFetch).toHaveBeenCalledWith(
      '/api/inventory',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Milk', measure: 'GRAMS', amount: 500, expiration: '2026-07-01', barcode: '12345' }),
      }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ uuid: 'item-1', name: 'Milk', measure: grams, amount: 500, expiration: '2026-07-01', barcode: '12345' });
  });

  it('creates an inventory item without a barcode', async () => {
    mockBackend(
      { ok: true, json: async () => [grams] },
      {
        ok: true,
        json: async () => ({ uuid: 'item-2', name: 'Eggs', measure: 'GRAMS', amount: 6, expiration: '2026-07-05' }),
      },
    );

    const create: CreateInventoryItem = { name: 'Eggs', measureId: 'GRAMS', amount: 6, expiration: '2026-07-05' };
    const request = new Request('http://localhost/api/inventory', {
      method: 'POST',
      body: JSON.stringify(create),
    });
    const response = await POST(request);

    expect(backendFetch).toHaveBeenCalledWith(
      '/api/inventory',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Eggs', measure: 'GRAMS', amount: 6, expiration: '2026-07-05' }),
      }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ uuid: 'item-2', name: 'Eggs', measure: grams, amount: 6, expiration: '2026-07-05' });
  });

  it('proxies the backend error status', async () => {
    (backendFetch as jest.Mock).mockResolvedValue({ ok: false, status: 400 });

    const request = new Request('http://localhost/api/inventory', {
      method: 'POST',
      body: JSON.stringify({ name: '', measureId: '', amount: 0, expiration: '' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
