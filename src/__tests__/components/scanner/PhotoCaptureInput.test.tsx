import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PhotoCaptureInput from '@/components/scanner/PhotoCaptureInput';
import { compressToBase64 } from '@/lib/imageCapture';

jest.mock('@/lib/imageCapture', () => ({ compressToBase64: jest.fn() }));

describe('PhotoCaptureInput', () => {
  beforeEach(() => {
    (compressToBase64 as jest.Mock).mockReset();
  });

  it('compresses the chosen photo and emits the base64 result', async () => {
    (compressToBase64 as jest.Mock).mockResolvedValue('base64jpeg');
    const onCaptured = jest.fn();
    render(<PhotoCaptureInput label="Photo of expiration date" onCaptured={onCaptured} />);

    const file = new File(['photo-bytes'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Photo of expiration date'), {
      target: { files: [file] },
    });

    await waitFor(() => expect(onCaptured).toHaveBeenCalledWith('base64jpeg'));
    expect(compressToBase64).toHaveBeenCalledWith(file, undefined, undefined);
  });

  it('passes through custom compression settings when given', async () => {
    (compressToBase64 as jest.Mock).mockResolvedValue('base64jpeg');
    const onCaptured = jest.fn();
    render(
      <PhotoCaptureInput label="Photo of barcode" onCaptured={onCaptured} maxDim={800} quality={0.85} />,
    );

    const file = new File(['photo-bytes'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Photo of barcode'), { target: { files: [file] } });

    await waitFor(() => expect(onCaptured).toHaveBeenCalledWith('base64jpeg'));
    expect(compressToBase64).toHaveBeenCalledWith(file, 800, 0.85);
  });

  it('emits nothing when compression fails', async () => {
    (compressToBase64 as jest.Mock).mockRejectedValue(new Error('bad image'));
    const onCaptured = jest.fn();
    render(<PhotoCaptureInput label="Photo of measure" onCaptured={onCaptured} />);

    const file = new File(['photo-bytes'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Photo of measure'), { target: { files: [file] } });

    await waitFor(() => expect(compressToBase64).toHaveBeenCalled());
    expect(onCaptured).not.toHaveBeenCalled();
  });

  describe('where the device has a camera API', () => {
    const photo = new Blob(['jpeg'], { type: 'image/jpeg' });
    const stopTrack = jest.fn();
    const originalMatchMedia = window.matchMedia;

    function useDevice({ touchScreen }: { touchScreen: boolean }) {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) },
      });
      window.matchMedia = ((query: string) => ({ matches: touchScreen && query === '(pointer: coarse)' })) as never;
    }

    beforeAll(() => {
      Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 640 });
      Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 480 });
      HTMLCanvasElement.prototype.getContext = jest.fn(() => ({ drawImage: jest.fn() })) as never;
      HTMLCanvasElement.prototype.toBlob = jest.fn((callback: BlobCallback) => callback(photo));
    });

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
    });

    it('keeps the native camera input on a touch screen', () => {
      useDevice({ touchScreen: true });
      render(<PhotoCaptureInput label="Take photo" onCaptured={jest.fn()} />);

      expect(screen.getByLabelText('Take photo')).toHaveAttribute('type', 'file');
      expect(screen.queryByText('Choose file')).not.toBeInTheDocument();
    });

    it('opens a webcam preview on a laptop and emits the captured frame', async () => {
      useDevice({ touchScreen: false });
      (compressToBase64 as jest.Mock).mockResolvedValue('webcam-base64');
      const onCaptured = jest.fn();
      render(<PhotoCaptureInput label="Take photo" onCaptured={onCaptured} maxDim={800} quality={0.85} />);

      fireEvent.click(screen.getByRole('button', { name: 'Take photo' }));
      const dialog = await screen.findByRole('dialog', { name: 'Webcam' });
      fireEvent.loadedMetadata(dialog.querySelector('video') as HTMLVideoElement);
      fireEvent.click(screen.getByRole('button', { name: 'Capture' }));

      await waitFor(() => expect(onCaptured).toHaveBeenCalledWith('webcam-base64'));
      expect(compressToBase64).toHaveBeenCalledWith(photo, 800, 0.85);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(stopTrack).toHaveBeenCalled();
    });

    it('closes the preview without emitting anything when cancelled', async () => {
      useDevice({ touchScreen: false });
      const onCaptured = jest.fn();
      render(<PhotoCaptureInput label="Take photo" onCaptured={onCaptured} />);

      fireEvent.click(screen.getByRole('button', { name: 'Take photo' }));
      await screen.findByRole('dialog', { name: 'Webcam' });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(onCaptured).not.toHaveBeenCalled();
    });

    it('still lets a laptop user choose an existing file', async () => {
      useDevice({ touchScreen: false });
      (compressToBase64 as jest.Mock).mockResolvedValue('file-base64');
      const onCaptured = jest.fn();
      render(<PhotoCaptureInput label="Take photo" onCaptured={onCaptured} />);

      const file = new File(['photo-bytes'], 'photo.jpg', { type: 'image/jpeg' });
      fireEvent.change(screen.getByLabelText('Take photo from a file'), { target: { files: [file] } });

      await waitFor(() => expect(onCaptured).toHaveBeenCalledWith('file-base64'));
      expect(compressToBase64).toHaveBeenCalledWith(file, undefined, undefined);
    });
  });
});
