/** @jest-environment node */
import { GET } from '@/app/api/access/route';

jest.mock('@/lib/backend', () => ({ backendFetch: jest.fn() }));

const { backendFetch } = require('@/lib/backend');

describe('GET /api/access', () => {
  afterEach(() => (backendFetch as jest.Mock).mockReset());

  it('returns 200 when the backend probe succeeds', async () => {
    (backendFetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });

    const response = await GET();

    expect(backendFetch).toHaveBeenCalledWith('/api/measures');
    expect(response.status).toBe(200);
  });

  it('proxies the backend status when not allowed', async () => {
    (backendFetch as jest.Mock).mockResolvedValue({ ok: false, status: 403 });

    const response = await GET();

    expect(response.status).toBe(403);
  });
});
