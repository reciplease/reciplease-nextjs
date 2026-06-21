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
      }) as unknown as MediaQueryList;

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
