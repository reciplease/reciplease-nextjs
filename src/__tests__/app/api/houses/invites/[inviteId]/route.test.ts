/** @jest-environment node */
import { DELETE } from '@/app/api/houses/invites/[inviteId]/route';

jest.mock('@/lib/backend', () => ({ backendFetch: jest.fn() }));

const { backendFetch } = require('@/lib/backend');

describe('DELETE /api/houses/invites/[inviteId]', () => {
  afterEach(() => (backendFetch as jest.Mock).mockReset());

  it('forwards the delete to the backend and proxies a 204', async () => {
    (backendFetch as jest.Mock).mockResolvedValue({ ok: true, status: 204 });

    const response = await DELETE(new Request('http://localhost'), { params: Promise.resolve({ inviteId: 'invite-1' }) });

    expect(backendFetch).toHaveBeenCalledWith('/api/houses/invites/invite-1', { method: 'DELETE' });
    expect(response.status).toBe(204);
  });

  it('proxies a 404 when the invite does not belong to the house', async () => {
    (backendFetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });

    const response = await DELETE(new Request('http://localhost'), { params: Promise.resolve({ inviteId: 'invite-1' }) });

    expect(response.status).toBe(404);
  });
});
