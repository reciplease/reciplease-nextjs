import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { useMeasures, findMeasure } from '@/lib/measures';

const GRAMS: Measure = { measureId: 'GRAMS', singular: 'gram', plural: 'grams', short: 'g' };

describe('useMeasures', () => {
  afterEach(() => (global.fetch as jest.Mock).mockReset());

  it('fetches and returns the measure catalog', async () => {
    global.fetch = jest.fn().mockResolvedValue({ json: async () => [GRAMS] });

    const { result } = renderHook(() => useMeasures(), {
      wrapper: ({ children }) => (
        <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
      ),
    });

    await waitFor(() => expect(result.current).toEqual([GRAMS]));
    expect(fetch).toHaveBeenCalledWith('/api/measures');
  });

  it('returns an empty array before the fetch resolves', () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useMeasures(), {
      wrapper: ({ children }) => (
        <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
      ),
    });

    expect(result.current).toEqual([]);
  });
});

describe('findMeasure', () => {
  it('finds a measure by id', () => {
    expect(findMeasure('GRAMS', [GRAMS])).toEqual(GRAMS);
  });

  it('returns undefined for an unknown id', () => {
    expect(findMeasure('UNKNOWN', [GRAMS])).toBeUndefined();
  });
});
