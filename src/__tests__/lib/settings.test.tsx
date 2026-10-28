import { render, screen, act, fireEvent } from '@testing-library/react';
import { useSettings } from '@/lib/settings';

const STORAGE_KEY = 'reciplease.settings.v1';

function TestComponent() {
  const { settings, setMotion } = useSettings();
  return (
    <div>
      motion:{settings.motion}
      <button onClick={() => setMotion('system')}>use system</button>
    </div>
  );
}

describe('settings store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('reduce-motion');
  });

  it('falls back to defaults when localStorage holds invalid JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not-json{');
    render(<TestComponent />);
    expect(screen.getByText('motion:system')).toBeInTheDocument();
  });

  it('applies dark theme and reduce-motion classes when another tab changes settings', () => {
    render(<TestComponent />);

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ motion: 'reduced' }));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    });

    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(true);
    expect(screen.getByText('motion:reduced')).toBeInTheDocument();
  });

  it('respects the OS reduced-motion preference when motion is set to system', () => {
    window.matchMedia = (query: string) =>
      ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as never;

    render(<TestComponent />);
    fireEvent.click(screen.getByText('use system'));

    expect(document.documentElement.classList.contains('reduce-motion')).toBe(true);
  });

  it('ignores storage events for unrelated keys', () => {
    render(<TestComponent />);

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'some-other-key' }));
    });

    expect(screen.getByText('motion:system')).toBeInTheDocument();
  });
});

describe('settings store on page load', () => {
  const originalMatchMedia = window.matchMedia;
  const changeListeners = new Set<() => void>();
  let osPrefersReducedMotion = false;

  function mockMatchMedia() {
    window.matchMedia = (query: string) =>
      ({
        get matches() {
          return osPrefersReducedMotion;
        },
        media: query,
        onchange: null,
        addEventListener: (type: string, listener: () => void) => {
          if (type === 'change') changeListeners.add(listener);
        },
        removeEventListener: (type: string, listener: () => void) => {
          if (type === 'change') changeListeners.delete(listener);
        },
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as never;
  }

  function changeOsPreference(reduced: boolean) {
    osPrefersReducedMotion = reduced;
    act(() => {
      changeListeners.forEach((listener) => listener());
    });
  }

  const hasReduceMotionClass = () => document.documentElement.classList.contains('reduce-motion');

  beforeEach(() => {
    osPrefersReducedMotion = false;
    changeListeners.clear();
    mockMatchMedia();
    window.localStorage.clear();
    document.documentElement.classList.remove('reduce-motion', 'theme-dark');
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    window.localStorage.clear();
    document.documentElement.classList.remove('reduce-motion', 'theme-dark');
  });

  it('applies reduce-motion on load when the stored motion setting is reduced', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ motion: 'reduced' }));

    render(<TestComponent />);

    expect(hasReduceMotionClass()).toBe(true);
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
  });

  it('applies reduce-motion on load when motion is system and the OS prefers reduced motion', () => {
    osPrefersReducedMotion = true;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ motion: 'system' }));

    render(<TestComponent />);

    expect(hasReduceMotionClass()).toBe(true);
  });

  it('does not apply reduce-motion on load when motion is system and the OS has no preference', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ motion: 'system' }));

    render(<TestComponent />);

    expect(hasReduceMotionClass()).toBe(false);
  });

  it('follows OS preference changes while motion is system', () => {
    render(<TestComponent />);
    expect(hasReduceMotionClass()).toBe(false);

    changeOsPreference(true);
    expect(hasReduceMotionClass()).toBe(true);

    changeOsPreference(false);
    expect(hasReduceMotionClass()).toBe(false);
  });

  it('ignores OS preference changes when motion is full', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ motion: 'full' }));
    render(<TestComponent />);

    changeOsPreference(true);

    expect(hasReduceMotionClass()).toBe(false);
  });

  it('stops listening for OS preference changes once unmounted', () => {
    const { unmount } = render(<TestComponent />);
    expect(changeListeners.size).toBe(1);

    unmount();

    expect(changeListeners.size).toBe(0);
  });
});
