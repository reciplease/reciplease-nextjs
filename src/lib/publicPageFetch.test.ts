jest.mock('next/router', () => ({ replace: jest.fn(), asPath: '/recipes/abc' }));

import Router from 'next/router';
import { fetchOrRedirect } from '@/lib/publicPageFetch';

describe('fetchOrRedirect', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    (Router.replace as jest.Mock).mockReset();
  });

  it('returns the parsed JSON on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ hi: 1 }) });

    expect(await fetchOrRedirect('/api/recipes')).toEqual({ hi: 1 });
    expect(Router.replace).not.toHaveBeenCalled();
  });

  it('redirects to /login on a 401 and rejects', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });

    await expect(fetchOrRedirect('/api/recipes')).rejects.toThrow();
    expect(Router.replace).toHaveBeenCalledWith('/login?callbackUrl=%2Frecipes%2Fabc');
  });

  it('rejects on a non-401 error without redirecting', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });

    await expect(fetchOrRedirect('/api/recipes')).rejects.toThrow();
    expect(Router.replace).not.toHaveBeenCalled();
  });
});
