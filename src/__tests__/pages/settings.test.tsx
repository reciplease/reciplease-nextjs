import { render, screen, fireEvent } from '@testing-library/react';
import SettingsPage from '@/pages/settings';

jest.mock('@/components/Metadata', () => () => null);

const STORAGE_KEY = 'reciplease.settings.v1';

function renderPage() {
  return render(
      <SettingsPage />
  );
}

function stored() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

describe('Settings page', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults the motion preference to Automatic', () => {
    renderPage();
    // The app is dark-only, so Animations is the only preference group.
    const automatic = screen.getByRole('radio', { name: 'Automatic' });
    expect(automatic).toBeChecked();
  });

  it('records a reduced-motion preference and persists it', () => {
    renderPage();
    fireEvent.click(screen.getByRole('radio', { name: 'Reduced' }));

    expect(screen.getByRole('radio', { name: 'Reduced' })).toBeChecked();
    expect(stored().motion).toBe('reduced');
  });

  it('restores previously stored preferences on mount', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ motion: 'reduced' }),
    );
    renderPage();

    expect(screen.getByRole('radio', { name: 'Reduced' })).toBeChecked();
  });
});
