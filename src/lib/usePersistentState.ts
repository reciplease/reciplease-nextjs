import { useEffect, useState } from 'react';

/**
 * useState that mirrors its value to localStorage (or sessionStorage) under
 * `key`, so it survives a reload. Starts at `defaultValue` on every render —
 * including the first client render — and only swaps in the stored value
 * from an effect, so server and client markup match on hydration; callers
 * that flash the default briefly before storage loads are fine, since this
 * is meant for view-state (filters, sort order), not content.
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T,
  storage: Storage = typeof window === 'undefined' ? (undefined as never) : window.localStorage,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    if (!storage) return;
    const stored = storage.getItem(key);
    if (stored === null) return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(JSON.parse(stored) as T);
    } catch {
      // Corrupt or stale value written by an older shape — ignore and keep the default.
    }
    // Only run on mount: `key`/`storage` are expected to stay stable for the
    // lifetime of the component, and re-running on every `storage` identity
    // change (a new object each render if the caller doesn't memoize it)
    // would re-read on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set(next: T) {
    setValue(next);
    storage?.setItem(key, JSON.stringify(next));
  }

  return [value, set];
}
