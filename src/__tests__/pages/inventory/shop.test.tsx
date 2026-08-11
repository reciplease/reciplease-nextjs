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
jest.mock('@/lib/imageCapture', () => ({
  compressToBase64: jest.fn(),
  toDataUrl: (base64: string) => `data:image/jpeg;base64,${base64}`,
}));
jest.mock('swr');
jest.mock('@/lib/houses', () => ({
  apiFetch: (...args: unknown[]) => (global.fetch as jest.Mock)(...args),
  useActiveHouse: () => ({ id: 'house-1', name: 'Home' }),
}));

const { compressToBase64 } = require('@/lib/imageCapture');
const useSWR = require('swr').default;

global.fetch = jest.fn();

function mockPostOk() {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
}

async function capturePhoto(label: string, base64: string) {
  (compressToBase64 as jest.Mock).mockResolvedValueOnce(base64);
  const file = new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' });
  fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } });
  const retakeLabel = label.replace('Take picture of', 'Retake picture of');
  await waitFor(() => screen.getByLabelText(retakeLabel));
}

function scanBarcode() {
  fireEvent.click(screen.getByText('Scan barcode'));
  fireEvent.click(screen.getByTestId('barcode-scanner'));
}

// Drive one full capture: scan barcode + both photos, in any order, then submit.
async function captureAndSubmitOneItem() {
  scanBarcode();
  await waitFor(() => screen.getByText('1234567890123'));
  await capturePhoto('Take picture of expiration', 'exp-base64');
  await capturePhoto('Take picture of measure', 'measure-base64');
  fireEvent.click(screen.getByText('Submit'));
}

describe('ShopPage', () => {
  const mutate = jest.fn();

  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
    (compressToBase64 as jest.Mock).mockReset();
    mutate.mockReset();
    useSWR.mockReturnValue({ data: [], mutate, isLoading: false });
  });

  it('starts with all three captures available and a running count of zero', () => {
    render(<ShopPage />);
    expect(screen.getByText('Scan barcode')).toBeInTheDocument();
    expect(screen.getByLabelText('Take picture of expiration')).toBeInTheDocument();
    expect(screen.getByLabelText('Take picture of measure')).toBeInTheDocument();
    expect(screen.getByText('0 items captured')).toBeInTheDocument();
  });

  it('counts pre-existing pending items for the house, not just this session', () => {
    useSWR.mockReturnValue({
      data: [{ uuid: 'p1' }, { uuid: 'p2' }] as PendingInventoryItem[],
      mutate,
      isLoading: false,
    });
    render(<ShopPage />);
    expect(screen.getByText('2 items captured')).toBeInTheDocument();
  });

  it('captures the three steps in any order and shows a preview of each', async () => {
    render(<ShopPage />);

    // Photos first, barcode last — order is not enforced.
    await capturePhoto('Take picture of measure', 'measure-base64');
    expect(screen.getByAltText('Measure photo preview')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,measure-base64',
    );

    await capturePhoto('Take picture of expiration', 'exp-base64');
    expect(screen.getByAltText('Expiration photo preview')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,exp-base64',
    );

    scanBarcode();
    await waitFor(() => screen.getByText('1234567890123'));
  });

  it('captures barcode + both photos and posts the pending item on submit', async () => {
    mockPostOk();
    render(<ShopPage />);

    await captureAndSubmitOneItem();

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
    // A successful upload revalidates the pending count from the backend
    // rather than incrementing a local counter.
    await waitFor(() => expect(mutate).toHaveBeenCalled());
  });

  it('submits with only some captures filled in — no validation blocks it', async () => {
    mockPostOk();
    render(<ShopPage />);

    scanBarcode();
    await waitFor(() => screen.getByText('1234567890123'));
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/inventory/pending',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ barcode: '1234567890123' }),
        }),
      );
    });
    await waitFor(() => expect(mutate).toHaveBeenCalled());
  });

  it('a manually entered barcode is captured the same way', async () => {
    render(<ShopPage />);

    fireEvent.click(screen.getByText('Scan barcode'));
    fireEvent.change(screen.getByLabelText('Or enter a barcode manually'), {
      target: { value: '5012345678900' },
    });
    fireEvent.click(screen.getByText('Use barcode'));

    await waitFor(() => screen.getByText('5012345678900'));
  });

  it('shows a retry banner when an upload fails, and retrying re-posts it', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: false });
    render(<ShopPage />);

    await captureAndSubmitOneItem();

    await waitFor(() => {
      expect(screen.getByText(/1 item failed to upload/)).toBeInTheDocument();
    });
    expect(mutate).not.toHaveBeenCalled();

    mockPostOk();
    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(screen.queryByText(/failed to upload/)).not.toBeInTheDocument();
    // Original + retry.
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('counts an upload that throws as failed too', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    render(<ShopPage />);

    await captureAndSubmitOneItem();

    await waitFor(() => {
      expect(screen.getByText(/1 item failed to upload/)).toBeInTheDocument();
    });
  });

  it('does not post anything when submitting with nothing captured', async () => {
    render(<ShopPage />);

    fireEvent.click(screen.getByText('Submit'));

    expect(fetch).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByText('0 items captured')).toBeInTheDocument();
  });

  it('resets all three captures after submit, ready for the next item', async () => {
    mockPostOk();
    render(<ShopPage />);

    await captureAndSubmitOneItem();

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(screen.getByText('Scan barcode')).toBeInTheDocument();
    expect(screen.getByLabelText('Take picture of expiration')).toBeInTheDocument();
    expect(screen.getByLabelText('Take picture of measure')).toBeInTheDocument();
  });

  it('disables the footer button while an upload is still in flight', async () => {
    let resolveUpload!: (value: unknown) => void;
    (fetch as jest.Mock).mockReturnValue(new Promise((resolve) => { resolveUpload = resolve; }));
    render(<ShopPage />);

    await captureAndSubmitOneItem();

    expect(screen.getByRole('button', { name: /Uploading/ })).toBeDisabled();

    resolveUpload({ ok: true, json: async () => ({}) });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Process captured items' })).not.toBeDisabled(),
    );
  });

  it('explains a permission failure instead of offering a retry', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 403 });
    render(<ShopPage />);

    await captureAndSubmitOneItem();

    await waitFor(() => {
      expect(screen.getByText(/permission/)).toBeInTheDocument();
    });
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('the footer button navigates to the processing page', () => {
    const push = jest.fn();
    jest.spyOn(require('next/router'), 'useRouter').mockReturnValue({ push });
    render(<ShopPage />);

    fireEvent.click(screen.getByText('Process captured items'));

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
