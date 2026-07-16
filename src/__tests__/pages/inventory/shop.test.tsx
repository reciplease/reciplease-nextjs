import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ShopPage from '@/pages/inventory/shop';

jest.mock('@/components/scanner/BarcodeScanner', () =>
  function MockBarcodeScanner({ onDetected, active }: { onDetected: (b: string) => void; active: boolean }) {
    return (
      <button
        data-testid="barcode-scanner"
        disabled={!active}
        onClick={() => onDetected('1234567890123')}
      >
        Simulate barcode scan
      </button>
    );
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
jest.mock('@/lib/imageCapture', () => ({ compressToBase64: jest.fn() }));

const { compressToBase64 } = require('@/lib/imageCapture');

global.fetch = jest.fn();

function mockPostOk() {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
}

async function capturePhoto(label: string, base64: string) {
  (compressToBase64 as jest.Mock).mockResolvedValueOnce(base64);
  const file = new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' });
  fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } });
}

// Drive one full capture iteration: scan → expiration photo → measure photo.
async function captureOneItem() {
  fireEvent.click(screen.getByTestId('barcode-scanner'));
  await waitFor(() => screen.getByLabelText('Photo of expiration date'));
  await capturePhoto('Photo of expiration date', 'exp-base64');
  await waitFor(() => screen.getByLabelText('Photo of measure'));
  await capturePhoto('Photo of measure', 'measure-base64');
  await waitFor(() => screen.getByText('Scan barcode'));
}

describe('ShopPage', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
    (compressToBase64 as jest.Mock).mockReset();
  });

  it('starts in barcode phase with a running count of zero', () => {
    render(<ShopPage />);
    expect(screen.getByText('Scan barcode')).toBeInTheDocument();
    expect(screen.getByText('0 items captured')).toBeInTheDocument();
  });

  it('captures barcode + both photos, posts the pending item and loops back to scanning', async () => {
    mockPostOk();
    render(<ShopPage />);

    await captureOneItem();

    expect(fetch).toHaveBeenCalledWith(
      '/api/inventory/pending',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          barcode: '1234567890123',
          expirationImage: 'exp-base64',
          measureImage: 'measure-base64',
        }),
      }),
    );
    await waitFor(() => expect(screen.getByText('1 item captured')).toBeInTheDocument());
  });

  it('skipping both photos posts a barcode-only pending item', async () => {
    mockPostOk();
    render(<ShopPage />);

    fireEvent.click(screen.getByTestId('barcode-scanner'));
    await waitFor(() => screen.getByLabelText('Photo of expiration date'));
    fireEvent.click(screen.getByText('Skip'));
    await waitFor(() => screen.getByLabelText('Photo of measure'));
    fireEvent.click(screen.getByText('Skip'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/inventory/pending',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ barcode: '1234567890123' }),
        }),
      );
    });
    await waitFor(() => screen.getByText('Scan barcode'));
  });

  it('a manually entered barcode enters the same loop', async () => {
    mockPostOk();
    render(<ShopPage />);

    fireEvent.change(screen.getByLabelText('Or enter a barcode manually'), {
      target: { value: '5012345678900' },
    });
    fireEvent.click(screen.getByText('Use barcode'));

    await waitFor(() => screen.getByLabelText('Photo of expiration date'));
  });

  it('shows a retry banner when an upload fails, and retrying re-posts it', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: false });
    render(<ShopPage />);

    await captureOneItem();

    await waitFor(() => {
      expect(screen.getByText(/1 item failed to upload/)).toBeInTheDocument();
    });

    mockPostOk();
    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => expect(screen.getByText('1 item captured')).toBeInTheDocument());
    expect(screen.queryByText(/failed to upload/)).not.toBeInTheDocument();
    // Original + retry.
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('counts an upload that throws as failed too', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    render(<ShopPage />);

    await captureOneItem();

    await waitFor(() => {
      expect(screen.getByText(/1 item failed to upload/)).toBeInTheDocument();
    });
  });

  it('does not post anything when every capture step was skipped', async () => {
    render(<ShopPage />);

    fireEvent.click(screen.getByText('No barcode → photos only'));
    await waitFor(() => screen.getByLabelText('Photo of expiration date'));
    fireEvent.click(screen.getByText('Skip'));
    await waitFor(() => screen.getByLabelText('Photo of measure'));
    fireEvent.click(screen.getByText('Skip'));

    await waitFor(() => screen.getByText('Scan barcode'));
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText('0 items captured')).toBeInTheDocument();
  });

  it('disables Done while an upload is still in flight', async () => {
    let resolveUpload!: (value: unknown) => void;
    (fetch as jest.Mock).mockReturnValue(new Promise((resolve) => { resolveUpload = resolve; }));
    render(<ShopPage />);

    await captureOneItem();

    expect(screen.getByRole('button', { name: /Uploading/ })).toBeDisabled();

    resolveUpload({ ok: true, json: async () => ({}) });
    await waitFor(() => expect(screen.getByRole('button', { name: /Done/ })).not.toBeDisabled());
  });

  it('explains a permission failure instead of offering a retry', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 403 });
    render(<ShopPage />);

    await captureOneItem();

    await waitFor(() => {
      expect(screen.getByText(/permission/)).toBeInTheDocument();
    });
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('Done navigates to the processing page', () => {
    const push = jest.fn();
    jest.spyOn(require('next/router'), 'useRouter').mockReturnValue({ push });
    render(<ShopPage />);

    fireEvent.click(screen.getByText(/Done/));

    expect(push).toHaveBeenCalledWith('/inventory/shop/process');
  });

  it('navigates back to inventory', () => {
    const push = jest.fn();
    jest.spyOn(require('next/router'), 'useRouter').mockReturnValue({ push });
    render(<ShopPage />);
    fireEvent.click(screen.getByText('← Back to inventory'));
    expect(push).toHaveBeenCalledWith('/inventory');
  });
});
