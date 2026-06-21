/** @jest-environment node */
import { GET } from '@/app/api/measures/route';

jest.mock('@/lib/backend', () => ({ backendFetch: jest.fn() }));

const { backendFetch } = require('@/lib/backend');

describe('GET /api/measures', () => {
  afterEach(() => (backendFetch as jest.Mock).mockReset());

  it('returns the measures from the backend', async () => {
    const measures: Measure[] = [
      { measureId: 'GRAMS', singular: 'gram', plural: 'grams', short: 'g' },
    ];
    (backendFetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => measures });

    const response = await GET();

    expect(backendFetch).toHaveBeenCalledWith('/api/measures');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(measures);
  });

  it('proxies the backend error status when the request fails', async () => {
    (backendFetch as jest.Mock).mockResolvedValue({ ok: false, status: 502 });

    const response = await GET();

    expect(response.status).toBe(502);
  });
});
