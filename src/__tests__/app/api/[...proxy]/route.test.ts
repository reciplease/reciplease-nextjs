/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET, POST, DELETE } from '@/app/api/[...proxy]/route';

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('generic API proxy', () => {
  it('forwards a GET, including the session cookie, to the backend and relays the response', async () => {
    (fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const request = new NextRequest('http://localhost/api/houses', {
      headers: { cookie: 'reciplease-session=abc123' },
    });

    const response = await GET(request, { params: Promise.resolve({ proxy: ['houses'] }) });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/houses'),
      expect.objectContaining({ method: 'GET' }),
    );
    const [, init] = (fetch as jest.Mock).mock.calls[0];
    expect((init.headers as Headers).get('cookie')).toBe('reciplease-session=abc123');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('forwards query params and a JSON body for a POST', async () => {
    (fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 201 }));

    const request = new NextRequest('http://localhost/api/houses/invites?foo=bar', {
      method: 'POST',
      body: JSON.stringify({ role: 'OWNER' }),
    });

    await POST(request, { params: Promise.resolve({ proxy: ['houses', 'invites'] }) });

    const [url, init] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('http://localhost:8080/api/houses/invites?foo=bar');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ role: 'OWNER' }));
  });

  it('sends no body for a DELETE', async () => {
    (fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 204 }));

    const request = new NextRequest('http://localhost/api/houses/invites/invite-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ proxy: ['houses', 'invites', 'invite-1'] }),
    });

    const [, init] = (fetch as jest.Mock).mock.calls[0];
    expect(init.body).toBeUndefined();
    expect(response.status).toBe(204);
  });
});
