import { useSyncExternalStore } from 'react';

export type MotionSetting = 'system' | 'full' | 'reduced';

export interface Settings {
  motion: MotionSetting;
}

const DEFAULT_SETTINGS: Settings = {
  motion: 'system'
};

const STORAGE_KEY = 'reciplease.settings.v1';

// Keep track of the last parsed object to preserve its reference identity
let memoizedSettings: Settings = DEFAULT_SETTINGS;
let lastRawString: string | null = null;

function readStored(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;

    // If the raw string in localStorage hasn't changed, return the EXACT same object reference
    if (raw === lastRawString) {
      return memoizedSettings;
    }

    const parsed = JSON.parse(raw) as Partial<Settings>;

    lastRawString = raw;
    memoizedSettings = { ...DEFAULT_SETTINGS, ...parsed };
    return memoizedSettings;
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

const listeners = new Set<() => void>();

// 1. Keep this strictly for DOM side-effects. Do not trigger listeners here.
function applyDOMClasses(settings: Settings) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  root.classList.add('theme-dark');

  const reduced =
    settings.motion === 'reduced' ||
    (settings.motion === 'system' && prefersReducedMotion());
  root.classList.toggle('reduce-motion', reduced);
}

// 2. Create a clean broadcast mechanism
function updateSettings(settings: Settings) {
  if (typeof window === 'undefined') return;

  // Write to localStorage
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

  // Apply the DOM changes
  applyDOMClasses(settings);

  // Notify all active React hooks to pull the fresh data
  listeners.forEach((l) => l());
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);

  // This handles changes coming from OTHER tabs/windows
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      // Apply classes when another tab changes things
      applyDOMClasses(readStored());
      listener();
    }
  };

  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
};

export function useSettings() {
  const settings = useSyncExternalStore(
    subscribe,
    readStored,
    () => DEFAULT_SETTINGS
  );

  return {
    settings,
    setMotion: (motion: MotionSetting) => updateSettings({ motion })
  };
}