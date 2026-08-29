const mockApiFetch = jest.fn();
jest.mock('@/lib/houses', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import { apiClientMutator, isSuccessResponse } from '@/lib/apiClientMutator';

// Exercises the REAL apiClientMutator implementation — only apiFetch (the
// house-header-injecting wrapper around fetch) is mocked, so this proves the
// mutator itself builds the {data, status, headers} envelope every generated
// hook/function (src/types/generated/client.ts) expects.
describe('apiClientMutator', () => {
  afterEach(() => {
    mockApiFetch.mockReset();
  });

  it('resolves to the {data, status, headers} envelope on a successful JSON response', async () => {
    const headers = new Headers({ 'content-type': 'application/json' });
    mockApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers,
      json: async () => ({ hi: 1 }),
    });

    const result = await apiClientMutator<{ data: { hi: number }; status: number; headers: Headers }>(
      '/api/pantry/p1',
      { method: 'GET' },
    );

    expect(result).toEqual({ data: { hi: 1 }, status: 200, headers });
    expect(result.headers).toBeInstanceOf(Headers);
  });

  it('resolves with data: undefined for a 204/empty-body response, real status and headers', async () => {
    const headers = new Headers({ 'content-length': '0' });
    mockApiFetch.mockResolvedValue({
      ok: true,
      status: 204,
      headers,
      json: async () => {
        throw new Error('should not be called for empty body');
      },
    });

    const result = await apiClientMutator<{ data: undefined; status: number; headers: Headers }>(
      '/api/pantry/p1',
      { method: 'DELETE' },
    );

    expect(result).toEqual({ data: undefined, status: 204, headers });
  });

  it('resolves to the {data, status, headers} envelope on a 404 error response, not a rejection', async () => {
    const headers = new Headers({ 'content-type': 'application/json' });
    const errorBody = { timestamp: '2026-08-29T00:00:00Z', status: 404, error: 'Not Found', path: '/api/pantry/missing' };
    mockApiFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers,
      json: async () => errorBody,
    });

    await expect(apiClientMutator('/api/pantry/missing')).resolves.toEqual({
      data: errorBody,
      status: 404,
      headers,
    });
  });

  it('resolves to the {data, status, headers} envelope on a 500 error response, not a rejection', async () => {
    const headers = new Headers({ 'content-type': 'application/json' });
    const errorBody = { timestamp: '2026-08-29T00:00:00Z', status: 500, error: 'Internal Server Error', path: '/api/pantry/p1' };
    mockApiFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers,
      json: async () => errorBody,
    });

    await expect(apiClientMutator('/api/pantry/p1')).resolves.toEqual({
      data: errorBody,
      status: 500,
      headers,
    });
  });

  it('propagates a genuine network-level failure (apiFetch rejection) as a rejection, not swallowed', async () => {
    mockApiFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(apiClientMutator('/api/pantry/p1')).rejects.toThrow('Failed to fetch');
  });

  it('invokes apiFetch with the given url and options, proving house-header injection still happens', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({}),
    });

    const options = { method: 'POST', body: JSON.stringify({ foo: 'bar' }) };
    await apiClientMutator('/api/pantry/p1', options);

    expect(mockApiFetch).toHaveBeenCalledWith('/api/pantry/p1', options);
  });
});

describe('isSuccessResponse', () => {
  it.each([
    [200, true],
    [201, true],
    [204, true],
    [299, true],
    [400, false],
    [401, false],
    [404, false],
    [500, false],
  ])('status %d -> %s', (status, expected) => {
    expect(isSuccessResponse({ status })).toBe(expected);
  });
});
