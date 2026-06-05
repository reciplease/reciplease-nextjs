import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

// User-facing UI preferences, stored locally in the browser (no server round
// trip). `system` defers to the OS / browser (the prefers-* media queries);
// the explicit values let the user override that automatic behaviour.
export type ThemeSetting = 'system' | 'light' | 'dark';
export type MotionSetting = 'system' | 'full' | 'reduced';

export interface Settings {
  theme: ThemeSetting;
  motion: MotionSetting;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  motion: 'system',
};

// localStorage persists the override across browser sessions on this device.
// Versioned key so the shape can change without reading stale data.
const STORAGE_KEY = 'reciplease.settings.v1';

function readStored(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function prefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// Resolve the `system` values against the live media queries and reflect the
// result onto <html> as classes. The CSS in main.scss keys off these classes,
// so an explicit override always wins over the browser default.
function applySettings(settings: Settings) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  const dark =
    settings.theme === 'dark' ||
    (settings.theme === 'system' && prefersDark());
  root.classList.toggle('theme-dark', dark);
  root.classList.toggle('theme-light', !dark);

  const reduced =
    settings.motion === 'reduced' ||
    (settings.motion === 'system' && prefersReducedMotion());
  root.classList.toggle('reduce-motion', reduced);
}

interface SettingsContextValue {
  settings: Settings;
  setTheme: (theme: ThemeSetting) => void;
  setMotion: (motion: MotionSetting) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  // Hydrate from storage on mount (kept out of useState's initialiser so SSR
  // and the first client render agree, avoiding a hydration mismatch).
  useEffect(() => {
    setSettings(readStored());
  }, []);

  // Persist + apply whenever settings change.
  useEffect(() => {
    applySettings(settings);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage may be unavailable (private mode) — the in-memory state still
      // drives the UI for this session.
    }
  }, [settings]);

  // Re-apply when the OS preference changes while a `system` setting is active.
  useEffect(() => {
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => applySettings(settings);
    colorScheme.addEventListener('change', onChange);
    motion.addEventListener('change', onChange);
    return () => {
      colorScheme.removeEventListener('change', onChange);
      motion.removeEventListener('change', onChange);
    };
  }, [settings]);

  const value: SettingsContextValue = {
    settings,
    setTheme: (theme) => setSettings((s) => ({ ...s, theme })),
    setMotion: (motion) => setSettings((s) => ({ ...s, motion })),
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return ctx;
}
