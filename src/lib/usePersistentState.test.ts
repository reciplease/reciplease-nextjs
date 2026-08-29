import { renderHook, act, waitFor } from '@testing-library/react';
import { usePersistentState } from '@/lib/usePersistentState';

describe('usePersistentState', () => {
  beforeEach(() => window.localStorage.clear());

  it('starts at the default value', () => {
    const { result } = renderHook(() => usePersistentState('key', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('loads a previously stored value once mounted', async () => {
    window.localStorage.setItem('key', JSON.stringify('stored'));

    const { result } = renderHook(() => usePersistentState('key', 'default'));

    await waitFor(() => expect(result.current[0]).toBe('stored'));
  });

  it('persists updates to storage', () => {
    const { result } = renderHook(() => usePersistentState('key', 'default'));

    act(() => result.current[1]('updated'));

    expect(result.current[0]).toBe('updated');
    expect(window.localStorage.getItem('key')).toBe(JSON.stringify('updated'));
  });

  it('persists across remounts', () => {
    const { result, unmount } = renderHook(() => usePersistentState('key', 'default'));
    act(() => result.current[1]('updated'));
    unmount();

    const { result: result2 } = renderHook(() => usePersistentState('key', 'default'));

    return waitFor(() => expect(result2.current[0]).toBe('updated'));
  });

  it('falls back to the default on corrupt stored JSON', () => {
    window.localStorage.setItem('key', 'not json');

    const { result } = renderHook(() => usePersistentState('key', 'default'));

    expect(result.current[0]).toBe('default');
  });

  it('supports objects', () => {
    const { result } = renderHook(() => usePersistentState('key', { on: false }));

    act(() => result.current[1]({ on: true }));

    expect(result.current[0]).toEqual({ on: true });
    expect(window.localStorage.getItem('key')).toBe(JSON.stringify({ on: true }));
  });

  it('uses sessionStorage when passed explicitly', () => {
    const { result } = renderHook(() => usePersistentState('key', 'default', window.sessionStorage));

    act(() => result.current[1]('updated'));

    expect(window.sessionStorage.getItem('key')).toBe(JSON.stringify('updated'));
    expect(window.localStorage.getItem('key')).toBeNull();
  });
});
