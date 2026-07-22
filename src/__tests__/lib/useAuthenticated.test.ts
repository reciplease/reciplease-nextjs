import { renderHook } from '@testing-library/react';
import { useAuthenticated } from '@/lib/useAuthenticated';

jest.mock('next-auth/react', () => ({ useSession: jest.fn() }));

const { useSession } = require('next-auth/react');

describe('useAuthenticated', () => {
  it('is true when the session is authenticated with no error', () => {
    (useSession as jest.Mock).mockReturnValue({ status: 'authenticated', data: { user: {} } });

    expect(renderHook(() => useAuthenticated()).result.current).toBe(true);
  });

  it('is false when the session is authenticated but flags an error (e.g. an expired token)', () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: {}, error: 'SessionExpired' },
    });

    expect(renderHook(() => useAuthenticated()).result.current).toBe(false);
  });

  it('is false when unauthenticated', () => {
    (useSession as jest.Mock).mockReturnValue({ status: 'unauthenticated', data: null });

    expect(renderHook(() => useAuthenticated()).result.current).toBe(false);
  });

  it('is false while loading', () => {
    (useSession as jest.Mock).mockReturnValue({ status: 'loading', data: undefined });

    expect(renderHook(() => useAuthenticated()).result.current).toBe(false);
  });
});
