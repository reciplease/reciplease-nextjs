import { render, act } from '@testing-library/react';
import ExpirationScanner from '@/components/scanner/ExpirationScanner';

const mockTerminate = jest.fn();
const mockRecognize = jest.fn();
const mockCreateWorker = jest.fn();

jest.mock('tesseract.js', () => ({
  createWorker: (...args: unknown[]) => mockCreateWorker(...args),
}));

function makeStream() {
  const stop = jest.fn();
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  return { stream, stop };
}

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('ExpirationScanner', () => {
  let getUserMedia: jest.Mock;

  beforeEach(() => {
    mockTerminate.mockReset();
    mockRecognize.mockReset();
    mockCreateWorker.mockReset();
    mockCreateWorker.mockResolvedValue({ recognize: mockRecognize, terminate: mockTerminate });

    getUserMedia = jest.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });

    HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({ drawImage: jest.fn() });
  });

  it('renders a video element, canvas and looking-for-date overlay', () => {
    const { container } = render(<ExpirationScanner active={false} onDetected={jest.fn()} />);

    expect(container.querySelector('video')).toBeInTheDocument();
    expect(container.querySelector('canvas')).toBeInTheDocument();
    expect(container).toHaveTextContent('Looking for date…');
  });

  it('does not request the camera when inactive', () => {
    render(<ExpirationScanner active={false} onDetected={jest.fn()} />);

    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('silently degrades when the camera is unavailable', async () => {
    getUserMedia.mockRejectedValue(new Error('denied'));

    await act(async () => {
      render(<ExpirationScanner active onDetected={jest.fn()} />);
      await flush();
    });

    expect(mockCreateWorker).not.toHaveBeenCalled();
  });

  it('starts OCR immediately when the video is already playable', async () => {
    const { stream } = makeStream();
    getUserMedia.mockResolvedValue(stream);

    const { container } = render(<ExpirationScanner active onDetected={jest.fn()} />);
    const video = container.querySelector('video')!;
    Object.defineProperty(video, 'readyState', { value: 4, configurable: true });

    mockRecognize.mockResolvedValue({ data: { text: 'no date here' } });
    await flush();

    expect(mockCreateWorker).toHaveBeenCalledWith('eng');

    act(() => jest.advanceTimersByTime(1500));
    await flush();

    expect(mockRecognize).toHaveBeenCalled();
    expect(container).toHaveTextContent('Looking for date…');
  });

  it('waits for the canplay event before starting OCR when the video is not yet playable', async () => {
    const { stream } = makeStream();
    getUserMedia.mockResolvedValue(stream);
    mockRecognize.mockResolvedValue({ data: { text: 'no date here' } });

    const { container } = render(<ExpirationScanner active onDetected={jest.fn()} />);
    const video = container.querySelector('video')!;

    await flush();
    expect(mockCreateWorker).not.toHaveBeenCalled();

    act(() => video.dispatchEvent(new Event('canplay')));
    await flush();

    expect(mockCreateWorker).toHaveBeenCalledWith('eng');

    // readyState is still 0 (< 2), so the OCR tick bails out before recognizing.
    act(() => jest.advanceTimersByTime(1500));
    await flush();
    expect(mockRecognize).not.toHaveBeenCalled();
  });

  it('shows a candidate after the first match and confirms it after a second matching tick', async () => {
    const { stream } = makeStream();
    getUserMedia.mockResolvedValue(stream);

    const onDetected = jest.fn();
    const { container } = render(<ExpirationScanner active onDetected={onDetected} />);
    const video = container.querySelector('video')!;
    Object.defineProperty(video, 'readyState', { value: 4, configurable: true });

    mockRecognize.mockResolvedValue({ data: { text: 'Best before 15/01/2026' } });
    await flush();

    act(() => jest.advanceTimersByTime(1500));
    await flush();
    expect(container).toHaveTextContent('Detected: 2026-01-15');
    expect(onDetected).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(1500));
    await flush();
    expect(onDetected).toHaveBeenCalledWith('2026-01-15');
    expect(mockTerminate).toHaveBeenCalled();
  });

  it('resets the candidate count when a different date is read', async () => {
    const { stream } = makeStream();
    getUserMedia.mockResolvedValue(stream);

    const onDetected = jest.fn();
    const { container } = render(<ExpirationScanner active onDetected={onDetected} />);
    const video = container.querySelector('video')!;
    Object.defineProperty(video, 'readyState', { value: 4, configurable: true });

    mockRecognize.mockResolvedValue({ data: { text: '15/01/2026' } });
    await flush();

    act(() => jest.advanceTimersByTime(1500));
    await flush();
    expect(container).toHaveTextContent('Detected: 2026-01-15');

    mockRecognize.mockResolvedValue({ data: { text: '20/02/2026' } });
    act(() => jest.advanceTimersByTime(1500));
    await flush();
    expect(container).toHaveTextContent('Detected: 2026-02-20');
    expect(onDetected).not.toHaveBeenCalled();
  });

  it('ignores OCR errors and keeps scanning', async () => {
    const { stream } = makeStream();
    getUserMedia.mockResolvedValue(stream);

    const { container } = render(<ExpirationScanner active onDetected={jest.fn()} />);
    const video = container.querySelector('video')!;
    Object.defineProperty(video, 'readyState', { value: 4, configurable: true });

    mockRecognize.mockRejectedValue(new Error('OCR failed'));
    await flush();

    act(() => jest.advanceTimersByTime(1500));
    await flush();

    expect(container).toHaveTextContent('Looking for date…');
  });

  it('skips a tick when the canvas has no 2D context', async () => {
    const { stream } = makeStream();
    getUserMedia.mockResolvedValue(stream);
    HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue(null);

    const { container } = render(<ExpirationScanner active onDetected={jest.fn()} />);
    const video = container.querySelector('video')!;
    Object.defineProperty(video, 'readyState', { value: 4, configurable: true });

    mockRecognize.mockResolvedValue({ data: { text: '15/01/2026' } });
    await flush();

    act(() => jest.advanceTimersByTime(1500));
    await flush();

    expect(mockRecognize).not.toHaveBeenCalled();
  });

  it('stops the stream and clears state when becoming inactive', async () => {
    const { stream, stop } = makeStream();
    getUserMedia.mockResolvedValue(stream);

    const onDetected = jest.fn();
    const { container, rerender } = render(<ExpirationScanner active onDetected={onDetected} />);
    const video = container.querySelector('video')!;
    Object.defineProperty(video, 'readyState', { value: 4, configurable: true });
    mockRecognize.mockResolvedValue({ data: { text: 'no date here' } });
    await flush();

    rerender(<ExpirationScanner active={false} onDetected={onDetected} />);

    expect(mockTerminate).toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  it('stops the stream if the scanner becomes inactive before getUserMedia resolves', async () => {
    let resolveGetUserMedia!: (stream: MediaStream) => void;
    getUserMedia.mockImplementation(
      () => new Promise((resolve) => { resolveGetUserMedia = resolve; }),
    );

    const onDetected = jest.fn();
    const { rerender } = render(<ExpirationScanner active onDetected={onDetected} />);
    rerender(<ExpirationScanner active={false} onDetected={onDetected} />);

    const { stream, stop } = makeStream();
    await act(async () => {
      resolveGetUserMedia(stream);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(stop).toHaveBeenCalled();
    expect(mockCreateWorker).not.toHaveBeenCalled();
  });

  it('stops the stream if the scanner becomes inactive while waiting for the first frame', async () => {
    const { stream, stop } = makeStream();
    getUserMedia.mockResolvedValue(stream);

    const onDetected = jest.fn();
    const { container, rerender } = render(<ExpirationScanner active onDetected={onDetected} />);
    const video = container.querySelector('video')!;

    await flush();
    expect(mockCreateWorker).not.toHaveBeenCalled();

    rerender(<ExpirationScanner active={false} onDetected={onDetected} />);

    act(() => video.dispatchEvent(new Event('canplay')));
    await flush();

    expect(stop).toHaveBeenCalled();
    expect(mockCreateWorker).not.toHaveBeenCalled();
  });

  it('discards a recognized date if the scanner becomes inactive while OCR is running', async () => {
    const { stream } = makeStream();
    getUserMedia.mockResolvedValue(stream);

    let resolveRecognize!: (value: { data: { text: string } }) => void;
    mockRecognize.mockImplementation(
      () => new Promise((resolve) => { resolveRecognize = resolve; }),
    );

    const onDetected = jest.fn();
    const { container, rerender } = render(<ExpirationScanner active onDetected={onDetected} />);
    const video = container.querySelector('video')!;
    Object.defineProperty(video, 'readyState', { value: 4, configurable: true });
    await flush();

    act(() => jest.advanceTimersByTime(1500));
    await flush();

    rerender(<ExpirationScanner active={false} onDetected={onDetected} />);

    resolveRecognize({ data: { text: '15/01/2026' } });
    await flush();

    expect(container).toHaveTextContent('Looking for date…');
    expect(onDetected).not.toHaveBeenCalled();
  });

  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());
});
