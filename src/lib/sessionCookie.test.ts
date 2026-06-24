import { ensureSessionCookie, resetSessionCookieForTests } from '@/lib/sessionCookie';

describe('ensureSessionCookie', () => {
  const originalFetch = global.fetch;

  beforeEach(() => resetSessionCookieForTests());
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('hits /api/session-cookie once and shares the in-flight promise across callers', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 204 });

    await Promise.all([ensureSessionCookie(), ensureSessionCookie(), ensureSessionCookie()]);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/session-cookie');
  });

  it('does not re-sync on a subsequent call once resolved', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 204 });

    await ensureSessionCookie();
    await ensureSessionCookie();

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('clears the memo on failure so a later call can retry', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ status: 204 });

    await ensureSessionCookie(); // fails, memo cleared
    await ensureSessionCookie(); // retries

    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
