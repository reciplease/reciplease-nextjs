import { render, screen, waitFor } from '@testing-library/react';
import ScanPage from '@/pages/pantry/scan';

jest.mock('@/components/scanner/BarcodeScanner', () =>
  function MockBarcodeScanner() {
    return <div data-testid="barcode-scanner" />;
  },
);

jest.mock('next/dynamic', () => (fn: () => Promise<{ default: unknown }>) => {
  let Component: React.ComponentType<any> | null = null;
  fn().then((mod) => { Component = (mod as any).default ?? mod; });
  return function DynamicMock(props: any) {
    return Component ? <Component {...props} /> : null;
  };
});

jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/components/Metadata', () => () => null);

global.fetch = jest.fn();

describe('ScanPage measures fetcher', () => {
  afterEach(() => (fetch as jest.Mock).mockReset());

  it('loads measures from the API', async () => {
    const measures: Measure[] = [
      { measureId: 'g', singular: 'gram', plural: 'grams', short: 'g' },
    ];
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => measures });

    render(<ScanPage />);

    await waitFor(() => screen.getByTestId('barcode-scanner'));
    expect(fetch).toHaveBeenCalledWith('/api/measures');
  });
});
