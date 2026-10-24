import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ShopPage from '@/pages/pantry/shop';
import { listCaptures, loadDraft } from '@/lib/shopOutbox';

jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/components/Metadata', () => () => null);
jest.mock('@/lib/imageCapture', () => ({
  compressToBase64: jest.fn(),
  toDataUrl: (base64: string) => `data:image/jpeg;base64,${base64}`,
}));
jest.mock('swr');

let mockHouse = { id: 'house-1', name: 'Home', role: 'OWNER' };
jest.mock('@/lib/houses', () => ({
  useActiveHouse: () => mockHouse,
}));

jest.mock('@/lib/shopOutbox', () => {
  const actual = jest.requireActual('@/lib/shopOutbox');
  return { ...actual, addCapture: jest.fn(actual.addCapture) };
});

jest.mock('@/lib/apiClientMutator', () => ({
  isSuccessResponse: (response: { status: number }) => response.status >= 200 && response.status < 300,
}));

const { compressToBase64 } = require('@/lib/imageCapture');
const outbox = require('@/lib/shopOutbox');
const useSWR = require('swr').default;

const postMessage = jest.fn();
const registerSync = jest.fn();
let workerListeners: ((event: { data: unknown }) => void)[] = [];

beforeAll(() => {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: Promise.resolve({ active: { postMessage }, sync: { register: registerSync } }),
      addEventListener: (_type: string, listener: (event: { data: unknown }) => void) => workerListeners.push(listener),
      removeEventListener: (_type: string, listener: (event: { data: unknown }) => void) => {
        workerListeners = workerListeners.filter((existing) => existing !== listener);
      },
    },
  });
});

async function capturePhoto(label: string, base64: string) {
  (compressToBase64 as jest.Mock).mockResolvedValueOnce(base64);
  const file = new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' });
  fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } });
  const retakeLabel = label.replace(/^Take/, 'Retake');
  await waitFor(() => screen.getByLabelText(retakeLabel));
}

async function captureAndSubmitOneItem() {
  await capturePhoto('Take barcode photo', 'barcode-base64');
  await capturePhoto('Take picture of expiration', 'exp-base64');
  await capturePhoto('Take picture of measure', 'measure-base64');
  fireEvent.click(screen.getByText('Submit'));
}

async function waitingBanner(text: RegExp) {
  return waitFor(() => expect(screen.getByText(text)).toBeInTheDocument());
}

describe('ShopPage', () => {
  const mutate = jest.fn();

  beforeEach(() => {
    indexedDB = new IDBFactory();
    window.localStorage.clear();
    mockHouse = { id: 'house-1', name: 'Home', role: 'OWNER' };
    workerListeners = [];
    postMessage.mockReset();
    registerSync.mockReset().mockResolvedValue(undefined);
    outbox.addCapture.mockClear();
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

  it('stores a submitted capture on the device with a scan id and asks the service worker to upload it', async () => {
    render(<ShopPage />);

    await captureAndSubmitOneItem();

    await waitingBanner(/1 item saved on this device, waiting to upload/);
    const stored = await listCaptures('house-1');
    expect(stored).toEqual([
      {
        scanId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        houseId: 'house-1',
        capturedAt: expect.any(Number),
        barcodeImage: 'barcode-base64',
        expirationImage: 'exp-base64',
        measureImage: 'measure-base64',
      },
    ]);
    await waitFor(() => expect(postMessage).toHaveBeenCalledWith({ type: 'flush-shop' }));
    expect(registerSync).toHaveBeenCalledWith('shop-upload');
    expect(screen.getByText('1 item captured')).toBeInTheDocument();
  });

  it('submits with only some captures filled in — no validation blocks it', async () => {
    render(<ShopPage />);

    await capturePhoto('Take barcode photo', 'barcode-base64');
    fireEvent.click(screen.getByText('Submit'));

    await waitingBanner(/1 item saved on this device/);
    const [stored] = await listCaptures('house-1');
    expect(stored).toEqual({
      scanId: expect.any(String),
      houseId: 'house-1',
      capturedAt: expect.any(Number),
      barcodeImage: 'barcode-base64',
    });
  });

  it('gives every capture its own scan id', async () => {
    render(<ShopPage />);

    await captureAndSubmitOneItem();
    await waitingBanner(/1 item saved on this device/);
    await captureAndSubmitOneItem();
    await waitingBanner(/2 items saved on this device/);

    const scanIds = (await listCaptures('house-1')).map((capture) => capture.scanId);
    expect(new Set(scanIds).size).toBe(2);
  });

  it('does not store anything when submitting with nothing captured', async () => {
    render(<ShopPage />);

    fireEvent.click(screen.getByText('Submit'));

    await act(async () => {});
    expect(outbox.addCapture).not.toHaveBeenCalled();
    expect(screen.getByText('0 items captured')).toBeInTheDocument();
  });

  it('resets all three captures after submit, ready for the next item', async () => {
    render(<ShopPage />);

    await captureAndSubmitOneItem();

    await waitingBanner(/1 item saved on this device/);
    expect(screen.getByLabelText('Take barcode photo')).toBeInTheDocument();
    expect(screen.getByLabelText('Take picture of expiration')).toBeInTheDocument();
    expect(screen.getByLabelText('Take picture of measure')).toBeInTheDocument();
  });

  it('keeps unsubmitted photos across a reload', async () => {
    const { unmount } = render(<ShopPage />);
    await capturePhoto('Take barcode photo', 'barcode-base64');
    await waitFor(async () => expect((await loadDraft('house-1')).barcodeImage).toBe('barcode-base64'));
    unmount();

    render(<ShopPage />);

    await waitFor(() =>
      expect(screen.getByAltText('Barcode photo preview')).toHaveAttribute(
        'src',
        'data:image/jpeg;base64,barcode-base64',
      ),
    );
  });

  it('clears the saved draft once it is submitted', async () => {
    const { unmount } = render(<ShopPage />);
    await captureAndSubmitOneItem();
    await waitingBanner(/1 item saved on this device/);
    await waitFor(async () => expect((await loadDraft('house-1')).barcodeImage).toBeNull());
    unmount();

    render(<ShopPage />);

    await waitingBanner(/1 item saved on this device/);
    expect(screen.queryByAltText('Barcode photo preview')).not.toBeInTheDocument();
  });

  it('shows captures still waiting to upload after a reload', async () => {
    const { unmount } = render(<ShopPage />);
    await captureAndSubmitOneItem();
    await waitingBanner(/1 item saved on this device/);
    unmount();

    render(<ShopPage />);

    await waitingBanner(/1 item saved on this device/);
  });

  it('refreshes once the service worker reports the outbox changed', async () => {
    render(<ShopPage />);
    await captureAndSubmitOneItem();
    await waitingBanner(/1 item saved on this device/);

    indexedDB = new IDBFactory();
    act(() => workerListeners.forEach((listener) => listener({ data: { type: 'shop-outbox-changed' } })));

    await waitFor(() => expect(screen.queryByText(/waiting to upload/)).not.toBeInTheDocument());
    expect(mutate).toHaveBeenCalled();
  });

  it('ignores unrelated service worker messages', async () => {
    render(<ShopPage />);
    await act(async () => {});

    act(() => workerListeners.forEach((listener) => listener({ data: { type: 'other' } })));

    expect(mutate).not.toHaveBeenCalled();
  });

  it('lets the user trigger an upload by hand', async () => {
    render(<ShopPage />);
    await captureAndSubmitOneItem();
    await waitingBanner(/1 item saved on this device/);
    postMessage.mockClear();

    fireEvent.click(screen.getByText('Upload now'));

    await waitFor(() => expect(postMessage).toHaveBeenCalledWith({ type: 'flush-shop' }));
  });

  it('asks the service worker to upload again when the connection comes back', async () => {
    render(<ShopPage />);
    await captureAndSubmitOneItem();
    await waitingBanner(/1 item saved on this device/);
    postMessage.mockClear();

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(postMessage).toHaveBeenCalledWith({ type: 'flush-shop' }));
  });

  it('does not ask for an upload when nothing is waiting', async () => {
    render(<ShopPage />);
    await act(async () => {});

    expect(postMessage).not.toHaveBeenCalled();
  });

  it('keeps the photos and explains when the device cannot store the capture', async () => {
    outbox.addCapture.mockRejectedValueOnce(new Error('QuotaExceededError'));
    render(<ShopPage />);

    await captureAndSubmitOneItem();

    await waitingBanner(/Couldn't save this capture on your device/);
    expect(screen.getByAltText('Barcode photo preview')).toBeInTheDocument();
    expect(screen.queryByText(/waiting to upload/)).not.toBeInTheDocument();
  });

  it('explains a permission failure instead of storing captures for a read-only member', async () => {
    mockHouse = { id: 'house-1', name: 'Home', role: 'MEMBER' };
    render(<ShopPage />);

    await capturePhoto('Take barcode photo', 'barcode-base64');

    expect(screen.getByText(/permission/)).toBeInTheDocument();
    expect(screen.getByText('Submit')).toBeDisabled();
  });

  it('moves a failed-upload queue left in localStorage by the old version into the outbox', async () => {
    window.localStorage.setItem(
      'reciplease:shop-failed:house-1',
      JSON.stringify([{ barcodeImage: 'old-barcode' }, { measureImage: 'old-measure' }]),
    );

    render(<ShopPage />);

    await waitingBanner(/2 items saved on this device/);
    expect(window.localStorage.getItem('reciplease:shop-failed:house-1')).toBeNull();
    const stored = await listCaptures('house-1');
    expect(stored.map((capture) => capture.barcodeImage ?? capture.measureImage)).toEqual(['old-barcode', 'old-measure']);
    expect(new Set(stored.map((capture) => capture.scanId)).size).toBe(2);
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
