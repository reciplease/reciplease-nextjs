import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import WebcamCapture from '@/components/scanner/WebcamCapture';

const stopTrack = jest.fn();
const getUserMedia = jest.fn();
const drawImage = jest.fn();
const photo = new Blob(['jpeg'], { type: 'image/jpeg' });

beforeAll(() => {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 640 });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 480 });
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({ drawImage })) as never;
  HTMLCanvasElement.prototype.toBlob = jest.fn((callback: BlobCallback) => callback(photo));
});

beforeEach(() => {
  stopTrack.mockReset();
  drawImage.mockReset();
  getUserMedia.mockReset().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
});

function cameraReady() {
  act(() => {
    fireEvent.loadedMetadata(screen.getByLabelText('Webcam').querySelector('video') as HTMLVideoElement);
  });
}

describe('WebcamCapture', () => {
  it('asks for the camera and keeps Capture disabled until the video is playing', async () => {
    render(<WebcamCapture onCapture={jest.fn()} onClose={jest.fn()} />);

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledWith({ video: expect.objectContaining({ facingMode: 'environment' }) }));
    expect(screen.getByRole('button', { name: 'Capture' })).toBeDisabled();

    cameraReady();

    expect(screen.getByRole('button', { name: 'Capture' })).toBeEnabled();
  });

  it('hands over a JPEG of the current frame when Capture is pressed', async () => {
    const onCapture = jest.fn();
    render(<WebcamCapture onCapture={onCapture} onClose={jest.fn()} />);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    cameraReady();

    fireEvent.click(screen.getByRole('button', { name: 'Capture' }));

    expect(drawImage).toHaveBeenCalled();
    expect(onCapture).toHaveBeenCalledWith(photo);
  });

  it('switches the camera off when it closes', async () => {
    const { unmount } = render(<WebcamCapture onCapture={jest.fn()} onClose={jest.fn()} />);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    await act(async () => {});

    unmount();

    expect(stopTrack).toHaveBeenCalled();
  });

  it('switches off a camera that finished opening after it was closed', async () => {
    let openCamera!: (stream: unknown) => void;
    getUserMedia.mockReturnValue(new Promise((resolve) => { openCamera = resolve; }));
    const { unmount } = render(<WebcamCapture onCapture={jest.fn()} onClose={jest.fn()} />);
    unmount();

    await act(async () => openCamera({ getTracks: () => [{ stop: stopTrack }] }));

    expect(stopTrack).toHaveBeenCalled();
  });

  it('closes from Cancel and from Escape', async () => {
    const onClose = jest.fn();
    render(<WebcamCapture onCapture={jest.fn()} onClose={onClose} />);
    await act(async () => {});

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('explains a denied camera and offers no capture', async () => {
    getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    render(<WebcamCapture onCapture={jest.fn()} onClose={jest.fn()} />);

    await waitFor(() => expect(screen.getByText(/Couldn't open the camera/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Capture' })).toBeDisabled();
  });
});
