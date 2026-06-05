import { render, screen, fireEvent } from '@testing-library/react';
import SettingsPage from '@/pages/settings';
import { SettingsProvider } from '@/lib/settings';

jest.mock('@/components/Metadata', () => () => null);

const STORAGE_KEY = 'reciplease.settings.v1';

function renderPage() {
  return render(
    <SettingsProvider>
      <SettingsPage />
    </SettingsProvider>,
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

  it('defaults both preferences to Automatic', () => {
    renderPage();
    // Both the Appearance and Animations groups default to their Automatic option.
    const automatic = screen.getAllByRole('radio', { name: 'Automatic' });
    expect(automatic).toHaveLength(2);
    automatic.forEach((radio) => expect(radio).toBeChecked());
  });

  it('records a dark-mode override and persists it', () => {
    renderPage();
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));

    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(stored().theme).toBe('dark');
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
      JSON.stringify({ theme: 'dark', motion: 'reduced' }),
    );
    renderPage();

    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Reduced' })).toBeChecked();
  });
});
