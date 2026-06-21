/** @jest-environment node */
import { GET, POST } from '@/app/api/houses/invites/route';

jest.mock('@/lib/backend', () => ({ backendFetch: jest.fn() }));

const { backendFetch } = require('@/lib/backend');

describe('/api/houses/invites', () => {
  afterEach(() => (backendFetch as jest.Mock).mockReset());

  describe('GET', () => {
    it('proxies the pending invite list from the backend', async () => {
      const invites = [{ id: 'invite-1', code: 'abc123', role: 'READ_ONLY', createdAt: '2026-01-01T00:00:00Z' }];
      (backendFetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => invites });

      const response = await GET();

      expect(backendFetch).toHaveBeenCalledWith('/api/houses/invites');
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(invites);
    });

    it('proxies a non-ok backend status', async () => {
      (backendFetch as jest.Mock).mockResolvedValue({ ok: false, status: 403 });

      const response = await GET();

      expect(response.status).toBe(403);
    });
  });

  describe('POST', () => {
    it('forwards the create-invite request and returns the created invite', async () => {
      const invite = { id: 'invite-1', code: 'abc123', role: 'READ_ONLY', createdAt: '2026-01-01T00:00:00Z' };
      (backendFetch as jest.Mock).mockResolvedValue({ ok: true, status: 201, json: async () => invite });

      const request = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ role: 'READ_ONLY' }) });
      const response = await POST(request);

      expect(backendFetch).toHaveBeenCalledWith('/api/houses/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'READ_ONLY' }),
      });
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual(invite);
    });

    it('proxies a non-ok backend status', async () => {
      (backendFetch as jest.Mock).mockResolvedValue({ ok: false, status: 403 });

      const request = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ role: 'READ_ONLY' }) });
      const response = await POST(request);

      expect(response.status).toBe(403);
    });
  });
});
