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
//
// The app is dark-only — there is no light or automatic theme — so the only
// preference exposed here is the reduce-motion setting.
export type MotionSetting = 'system' | 'full' | 'reduced';

export interface Settings {
  motion: MotionSetting;
}

export const DEFAULT_SETTINGS: Settings = {
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

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// Reflect the resolved settings onto <html> as classes. The CSS in main.scss
// keys off these classes. The theme is always dark; only the reduce-motion
// preference resolves a `system` value against the live media query.
function applySettings(settings: Settings) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  root.classList.add('theme-dark');

  const reduced =
    settings.motion === 'reduced' ||
    (settings.motion === 'system' && prefersReducedMotion());
  root.classList.toggle('reduce-motion', reduced);
}

interface SettingsContextValue {
  settings: Settings;
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

  // Re-apply when the OS reduce-motion preference changes while `system` is active.
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => applySettings(settings);
    motion.addEventListener('change', onChange);
    return () => {
      motion.removeEventListener('change', onChange);
    };
  }, [settings]);

  const value: SettingsContextValue = {
    settings,
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
