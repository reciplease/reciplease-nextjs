/** @jest-environment node */
import { PATCH } from '@/app/api/houses/members/[userId]/route';

jest.mock('@/lib/backend', () => ({ backendFetch: jest.fn() }));

const { backendFetch } = require('@/lib/backend');

describe('PATCH /api/houses/members/[userId]', () => {
  afterEach(() => (backendFetch as jest.Mock).mockReset());

  it('forwards the role update to the backend', async () => {
    const updated = [{ userId: 'user-1', email: 'user1@example.com', role: 'OWNER' }];
    (backendFetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => updated });

    const request = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ role: 'OWNER' }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ userId: 'user-1' }) });

    expect(backendFetch).toHaveBeenCalledWith('/api/houses/members/user-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'OWNER' }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(updated);
  });

  it('proxies a non-ok backend status', async () => {
    (backendFetch as jest.Mock).mockResolvedValue({ ok: false, status: 403 });

    const request = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ role: 'OWNER' }) });
    const response = await PATCH(request, { params: Promise.resolve({ userId: 'user-1' }) });

    expect(response.status).toBe(403);
  });
});
