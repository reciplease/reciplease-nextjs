/** @jest-environment node */
import { GET } from '@/app/api/houses/members/route';

jest.mock('@/lib/backend', () => ({ backendFetch: jest.fn() }));

const { backendFetch } = require('@/lib/backend');

describe('GET /api/houses/members', () => {
  afterEach(() => (backendFetch as jest.Mock).mockReset());

  it('proxies the member list from the backend', async () => {
    const members = [{ userId: 'user-1', email: 'owner@example.com', role: 'OWNER' }];
    (backendFetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => members });

    const response = await GET();

    expect(backendFetch).toHaveBeenCalledWith('/api/houses/members');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(members);
  });

  it('proxies a non-ok backend status', async () => {
    (backendFetch as jest.Mock).mockResolvedValue({ ok: false, status: 403 });

    const response = await GET();

    expect(response.status).toBe(403);
  });
});
