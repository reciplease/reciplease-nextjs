/** @jest-environment node */
import { fetchMeasures, fetchMeasureById, toMeasure } from '@/lib/measures';

jest.mock('@/lib/backend', () => ({ backendFetch: jest.fn() }));

const { backendFetch } = require('@/lib/backend');

const grams: Measure = { measureId: 'GRAMS', singular: 'gram', plural: 'grams', short: 'g' };

describe('fetchMeasures', () => {
  afterEach(() => (backendFetch as jest.Mock).mockReset());

  it('returns the measures from the backend', async () => {
    (backendFetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [grams] });

    expect(await fetchMeasures()).toEqual([grams]);
    expect(backendFetch).toHaveBeenCalledWith('/api/measures');
  });

  it('throws when the backend request fails', async () => {
    (backendFetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

    await expect(fetchMeasures()).rejects.toThrow('Failed to fetch measures: 500');
  });
});

describe('fetchMeasureById', () => {
  afterEach(() => (backendFetch as jest.Mock).mockReset());

  it('returns the measure from the backend', async () => {
    (backendFetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => grams });

    expect(await fetchMeasureById('GRAMS')).toEqual(grams);
    expect(backendFetch).toHaveBeenCalledWith('/api/measures/GRAMS');
  });

  it('throws when the backend request fails', async () => {
    (backendFetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });

    await expect(fetchMeasureById('GRAMS')).rejects.toThrow("Failed to fetch measure 'GRAMS': 404");
  });
});

describe('toMeasure', () => {
  it('finds the measure by id', () => {
    expect(toMeasure('GRAMS', [grams])).toEqual(grams);
  });

  it('throws for an unknown measure id', () => {
    expect(() => toMeasure('KILOS', [grams])).toThrow('Unknown measure: KILOS');
  });
});
