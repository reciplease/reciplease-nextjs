import { fetchMeasureById, fetchMeasures, toMeasure } from './measures';
import { backendFetch } from '@/lib/backend';

jest.mock('@/lib/backend');

const mockedBackendFetch = backendFetch as jest.MockedFunction<
  typeof backendFetch
>;

const MEASURES: Measure[] = [
  { measureId: 'GRAMS', singular: 'gram', plural: 'grams' },
  { measureId: 'ITEMS', singular: 'item', plural: 'items' },
];

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

afterEach(() => jest.resetAllMocks());

describe('fetchMeasures', () => {
  it('returns the measures from the backend', async () => {
    mockedBackendFetch.mockResolvedValue(jsonResponse(MEASURES));

    await expect(fetchMeasures()).resolves.toEqual(MEASURES);
    expect(mockedBackendFetch).toHaveBeenCalledWith('/api/measures');
  });

  it('throws when the backend responds with an error', async () => {
    mockedBackendFetch.mockResolvedValue(jsonResponse(null, false, 502));

    await expect(fetchMeasures()).rejects.toThrow('Failed to fetch measures: 502');
  });
});

describe('toMeasure', () => {
  it('finds a measure by id', () => {
    expect(toMeasure('GRAMS', MEASURES)).toEqual(MEASURES[0]);
  });

  it('throws for an unknown measure', () => {
    expect(() => toMeasure('SPOONFULS', MEASURES)).toThrow(
      'Unknown measure: SPOONFULS',
    );
  });
});

describe('fetchMeasureById', () => {
  it('fetches a single measure by id from the backend', async () => {
    mockedBackendFetch.mockResolvedValue(jsonResponse(MEASURES[0]));

    await expect(fetchMeasureById('GRAMS')).resolves.toEqual(MEASURES[0]);
    expect(mockedBackendFetch).toHaveBeenCalledWith('/api/measures/GRAMS');
  });

  it('throws when the measure is not found', async () => {
    mockedBackendFetch.mockResolvedValue(jsonResponse(null, false, 404));

    await expect(fetchMeasureById('SPOONFULS')).rejects.toThrow(
      "Failed to fetch measure 'SPOONFULS': 404",
    );
  });
});
