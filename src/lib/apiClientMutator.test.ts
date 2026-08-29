const mockApiFetch = jest.fn();
jest.mock('@/lib/houses', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import { apiClientMutator } from '@/lib/apiClientMutator';

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

  it('rejects with an error including the status on a non-ok response', async () => {
    mockApiFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers(),
      text: async () => 'not found',
    });

    await expect(apiClientMutator('/api/pantry/missing')).rejects.toThrow(/404/);
  });

  it('rejects with an error including the status on a 500 response', async () => {
    mockApiFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers(),
      text: async () => 'boom',
    });

    await expect(apiClientMutator('/api/pantry/p1')).rejects.toThrow(/500/);
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
