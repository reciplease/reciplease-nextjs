import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ShopPage from '@/pages/pantry/shop';

jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/components/Metadata', () => () => null);
jest.mock('@/lib/imageCapture', () => ({
  compressToBase64: jest.fn(),
  toDataUrl: (base64: string) => `data:image/jpeg;base64,${base64}`,
}));
jest.mock('swr');
jest.mock('@/lib/houses', () => ({
  useActiveHouse: () => ({ id: 'house-1', name: 'Home' }),
}));

// The generated client (src/types/generated/client.ts) calls this mutator
// directly rather than `fetch` — mocking it here keeps the generated request
// building/response envelope handling exercised for real, while giving the
// tests a single, low-level seam to assert against (same role `global.fetch`
// played before this page migrated off hand-written apiFetch calls).
const mockApiClientMutator = jest.fn();
jest.mock('@/lib/apiClientMutator', () => ({
  apiClientMutator: (...args: unknown[]) => mockApiClientMutator(...args),
  isSuccessResponse: (response: { status: number }) => response.status >= 200 && response.status < 300,
  describeErrorStatus: (status: number) => {
    if (status === 401) return 'Please sign in again.';
    if (status === 403) return "You don't have permission to do that.";
    if (status === 404) return "That couldn't be found.";
    if (status >= 400 && status < 500) return 'Please check your input and try again.';
    return 'Something went wrong. Please try again.';
  },
}));

const { compressToBase64 } = require('@/lib/imageCapture');
const useSWR = require('swr').default;

function mockPostOk() {
  mockApiClientMutator.mockResolvedValue({ data: {}, status: 200, headers: new Headers() });
}

async function capturePhoto(label: string, base64: string) {
  (compressToBase64 as jest.Mock).mockResolvedValueOnce(base64);
  const file = new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' });
  fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } });
  const retakeLabel = label.replace(/^Take/, 'Retake');
  await waitFor(() => screen.getByLabelText(retakeLabel));
}

// Drive one full capture: barcode + both photos, in any order, then submit.
async function captureAndSubmitOneItem() {
  await capturePhoto('Take barcode photo', 'barcode-base64');
  await capturePhoto('Take picture of expiration', 'exp-base64');
  await capturePhoto('Take picture of measure', 'measure-base64');
  fireEvent.click(screen.getByText('Submit'));
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('ShopPage', () => {
  const mutate = jest.fn();

  beforeEach(() => {
    mockApiClientMutator.mockReset();
    (compressToBase64 as jest.Mock).mockReset();
    mutate.mockReset();
    useSWR.mockReturnValue({ data: { data: [], status: 200, headers: new Headers() }, mutate, isLoading: false });
  });

  it('starts with all three captures available and a running count of zero', () => {
    render(<ShopPage />);
    expect(screen.getByLabelText('Take barcode photo')).toBeInTheDocument();
    expect(screen.getByLabelText('Take picture of expiration')).toBeInTheDocument();
    expect(screen.getByLabelText('Take picture of measure')).toBeInTheDocument();
    expect(screen.getByText('0 items captured')).toBeInTheDocument();
  });

  it('counts pre-existing pending items for the house, not just this session', () => {
    useSWR.mockReturnValue({
      data: {
        data: [{ uuid: 'p1' }, { uuid: 'p2' }] as PendingPantryItem[],
        status: 200,
        headers: new Headers(),
      },
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

    await capturePhoto('Take barcode photo', 'barcode-base64');
    expect(screen.getByAltText('Barcode photo preview')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,barcode-base64',
    );
  });

  it('captures a barcode photo + both other photos and posts the pending item on submit', async () => {
    mockPostOk();
    render(<ShopPage />);

    await captureAndSubmitOneItem();

    expect(mockApiClientMutator).toHaveBeenCalledWith(
      '/api/pantry/pending',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          barcodeImage: 'barcode-base64',
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

    await capturePhoto('Take barcode photo', 'barcode-base64');
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockApiClientMutator).toHaveBeenCalledWith(
        '/api/pantry/pending',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ barcodeImage: 'barcode-base64' }),
        }),
      );
    });
    await waitFor(() => expect(mutate).toHaveBeenCalled());
  });

  it('shows a red retry banner when an upload fails, and retrying re-posts it', async () => {
    mockApiClientMutator.mockRejectedValueOnce(new Error('500 Internal Server Error'));
    render(<ShopPage />);

    await captureAndSubmitOneItem();

    await waitFor(() => {
      expect(screen.getByText(/1 item failed to upload/)).toBeInTheDocument();
    });
    expect(screen.getByText(/1 item failed to upload/).closest('div')).toHaveClass('bg-red-950/80');
    expect(mutate).not.toHaveBeenCalled();

    mockPostOk();
    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(screen.queryByText(/failed to upload/)).not.toBeInTheDocument();
    // Original + retry.
    expect(mockApiClientMutator).toHaveBeenCalledTimes(2);
  });

  it('turns the banner orange and hides Retry while a retry sweep is in flight', async () => {
    mockApiClientMutator.mockRejectedValueOnce(new Error('500 Internal Server Error'));
    render(<ShopPage />);

    await captureAndSubmitOneItem();
    await waitFor(() => screen.getByText(/1 item failed to upload/));

    let resolveRetry!: (value: unknown) => void;
    mockApiClientMutator.mockReturnValueOnce(new Promise((resolve) => { resolveRetry = resolve; }));
    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => expect(screen.getByText(/Retrying 1 failed upload/)).toBeInTheDocument());
    expect(screen.getByText(/Retrying 1 failed upload/).closest('div')).toHaveClass('bg-orange-950/80');
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();

    resolveRetry({ data: {}, status: 200, headers: new Headers() });
    await waitFor(() => expect(screen.queryByText(/Retrying/)).not.toBeInTheDocument());
  });

  it('auto-retries the failed queue once a new submission succeeds', async () => {
    mockApiClientMutator.mockRejectedValueOnce(new Error('500 Internal Server Error'));
    render(<ShopPage />);

    await captureAndSubmitOneItem();
    await waitFor(() => screen.getByText(/1 item failed to upload/));

    mockPostOk();
    await captureAndSubmitOneItem();

    // Original failing submit + the new successful one + the auto-retry of the failed one.
    await waitFor(() => expect(mockApiClientMutator).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.queryByText(/failed to upload/)).not.toBeInTheDocument());
  });

  it('persists the failed queue to localStorage and reloads it on the next mount', async () => {
    mockApiClientMutator.mockRejectedValueOnce(new Error('500 Internal Server Error'));
    const { unmount } = render(<ShopPage />);

    await captureAndSubmitOneItem();
    await waitFor(() => screen.getByText(/1 item failed to upload/));

    const stored = JSON.parse(window.localStorage.getItem('reciplease:shop-failed:house-1') ?? '[]');
    expect(stored).toHaveLength(1);

    unmount();
    render(<ShopPage />);

    await waitFor(() => {
      expect(screen.getByText(/1 item failed to upload/)).toBeInTheDocument();
    });
  });

  it('counts an upload that throws as failed too', async () => {
    mockApiClientMutator.mockRejectedValueOnce(new Error('offline'));
    render(<ShopPage />);

    await captureAndSubmitOneItem();

    await waitFor(() => {
      expect(screen.getByText(/1 item failed to upload/)).toBeInTheDocument();
    });
  });

  it('does not post anything when submitting with nothing captured', async () => {
    render(<ShopPage />);

    fireEvent.click(screen.getByText('Submit'));

    expect(mockApiClientMutator).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByText('0 items captured')).toBeInTheDocument();
  });

  it('resets all three captures after submit, ready for the next item', async () => {
    mockPostOk();
    render(<ShopPage />);

    await captureAndSubmitOneItem();

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(screen.getByLabelText('Take barcode photo')).toBeInTheDocument();
    expect(screen.getByLabelText('Take picture of expiration')).toBeInTheDocument();
    expect(screen.getByLabelText('Take picture of measure')).toBeInTheDocument();
  });

  it('disables the Process button while an upload is still in flight', async () => {
    let resolveUpload!: (value: unknown) => void;
    mockApiClientMutator.mockReturnValue(new Promise((resolve) => { resolveUpload = resolve; }));
    render(<ShopPage />);

    await captureAndSubmitOneItem();

    expect(screen.getByRole('button', { name: /Uploading/ })).toBeDisabled();

    resolveUpload({ data: {}, status: 200, headers: new Headers() });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Process →' })).not.toBeDisabled(),
    );
  });

  it('explains a permission failure instead of offering a retry', async () => {
    mockApiClientMutator.mockResolvedValue({ data: { timestamp: '', status: 403, error: 'Forbidden', path: '' }, status: 403, headers: new Headers() });
    render(<ShopPage />);

    await captureAndSubmitOneItem();

    await waitFor(() => {
      expect(screen.getByText(/permission/)).toBeInTheDocument();
    });
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('the small top-right Process button navigates to the processing page', () => {
    const push = jest.fn();
    jest.spyOn(require('next/router'), 'useRouter').mockReturnValue({ push });
    render(<ShopPage />);

    fireEvent.click(screen.getByText('Process →'));

    expect(push).toHaveBeenCalledWith('/pantry/shop/process');
  });

  it('navigates back to pantry', () => {
    const push = jest.fn();
    jest.spyOn(require('next/router'), 'useRouter').mockReturnValue({ push });
    render(<ShopPage />);
    fireEvent.click(screen.getByText('← Back to pantry'));
    expect(push).toHaveBeenCalledWith('/pantry');
  });
});
