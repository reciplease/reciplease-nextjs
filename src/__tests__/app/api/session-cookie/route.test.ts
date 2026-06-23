/** @jest-environment node */
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));

import { GET } from '@/app/api/session-cookie/route';

const { getServerSession } = require('next-auth');
const { cookies } = require('next/headers');

function cookieJar() {
  return { set: jest.fn(), delete: jest.fn() };
}

beforeEach(() => {
  (getServerSession as jest.Mock).mockReset();
  (cookies as jest.Mock).mockReset();
});

describe('GET /api/session-cookie', () => {
  it('sets the reciplease-session cookie from the current session token', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ accessToken: 'rcpls-jwt' });
    const jar = cookieJar();
    (cookies as jest.Mock).mockResolvedValue(jar);

    const response = await GET();

    expect(jar.set).toHaveBeenCalledWith(
      'reciplease-session',
      'rcpls-jwt',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
    );
    expect(response.status).toBe(204);
  });

  it('deletes the cookie when there is no session token', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const jar = cookieJar();
    (cookies as jest.Mock).mockResolvedValue(jar);

    await GET();

    expect(jar.delete).toHaveBeenCalledWith('reciplease-session');
    expect(jar.set).not.toHaveBeenCalled();
  });
});
