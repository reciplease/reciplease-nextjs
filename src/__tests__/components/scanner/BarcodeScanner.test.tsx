import { render, act } from '@testing-library/react';
import BarcodeScanner from '@/components/scanner/BarcodeScanner';

const mockStop = jest.fn();
const mockDecodeFromVideoDevice = jest.fn();

jest.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: jest.fn().mockImplementation(() => ({
    decodeFromVideoDevice: mockDecodeFromVideoDevice,
  })),
}));

type DecodeCallback = (result: { getText: () => string } | null, err: Error | null) => void;

describe('BarcodeScanner', () => {
  beforeEach(() => {
    mockStop.mockReset();
    mockDecodeFromVideoDevice.mockReset();
  });

  it('renders a video element and targeting reticle', () => {
    const { container } = render(<BarcodeScanner active={false} onDetected={jest.fn()} />);

    expect(container.querySelector('video')).toBeInTheDocument();
  });

  it('does not start the scanner when inactive', () => {
    render(<BarcodeScanner active={false} onDetected={jest.fn()} />);

    expect(mockDecodeFromVideoDevice).not.toHaveBeenCalled();
  });

  it('starts the decode loop when active, ignores frames without a result, and reports a detected barcode', async () => {
    let callback: DecodeCallback = () => {};
    mockDecodeFromVideoDevice.mockImplementation(async (_device, _video, cb: DecodeCallback) => {
      callback = cb;
      return { stop: mockStop };
    });
    const onDetected = jest.fn();

    await act(async () => {
      render(<BarcodeScanner active onDetected={onDetected} />);
    });

    act(() => callback(null, new Error('not found')));
    expect(onDetected).not.toHaveBeenCalled();

    act(() => callback({ getText: () => '0123456789012' }, null));
    expect(onDetected).toHaveBeenCalledWith('0123456789012');
    expect(mockStop).toHaveBeenCalled();
  });

  it('stops the reader on unmount', async () => {
    mockDecodeFromVideoDevice.mockResolvedValue({ stop: mockStop });

    let unmount!: () => void;
    await act(async () => {
      ({ unmount } = render(<BarcodeScanner active onDetected={jest.fn()} />));
    });

    unmount();

    expect(mockStop).toHaveBeenCalled();
  });

  it('skips starting the reader if unmounted before the @zxing/browser import resolves', async () => {
    mockDecodeFromVideoDevice.mockResolvedValue({ stop: mockStop });

    const { unmount } = render(<BarcodeScanner active onDetected={jest.fn()} />);
    unmount();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockDecodeFromVideoDevice).not.toHaveBeenCalled();
  });

  it('silently degrades when camera setup fails', async () => {
    mockDecodeFromVideoDevice.mockRejectedValue(new Error('camera denied'));

    await act(async () => {
      render(<BarcodeScanner active onDetected={jest.fn()} />);
    });
  });

  it('stops the reader if the component unmounts before setup resolves', async () => {
    let resolveDecode!: (controls: { stop: () => void }) => void;
    mockDecodeFromVideoDevice.mockImplementation(
      () => new Promise((resolve) => (resolveDecode = resolve)),
    );

    const { unmount } = render(<BarcodeScanner active onDetected={jest.fn()} />);

    // Let the dynamic import of @zxing/browser resolve and decodeFromVideoDevice
    // be invoked, but leave its promise pending.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockDecodeFromVideoDevice).toHaveBeenCalled();

    unmount();

    await act(async () => {
      resolveDecode({ stop: mockStop });
    });

    expect(mockStop).toHaveBeenCalled();
  });
});
