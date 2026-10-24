import { useEffect, useRef, useState } from 'react';

type Props = {
  onCapture: (photo: Blob) => void;
  onClose: () => void;
};

export default function WebcamCapture({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let closed = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((opened) => {
        if (closed) {
          opened.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = opened;
        if (videoRef.current) videoRef.current.srcObject = opened;
      })
      .catch(() => setError("Couldn't open the camera. Check the browser's camera permission."));

    return () => {
      closed = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  function snap() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob((photo) => photo && onCapture(photo), 'image/jpeg', 0.92);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Webcam" className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex-1 min-h-0 flex items-center justify-center">
        {error ? (
          <p className="px-6 text-center text-red-200">{error}</p>
        ) : (
          <video
            ref={videoRef}
            className="max-w-full max-h-full"
            autoPlay
            playsInline
            muted
            onLoadedMetadata={() => setReady(true)}
          />
        )}
      </div>
      <div className="flex items-center justify-center gap-4 px-6 py-4 bg-zinc-950">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-3 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold rounded-lg"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={snap}
          disabled={!ready}
          className="px-8 py-3 bg-highlight text-white font-semibold rounded-lg disabled:opacity-40"
        >
          Capture
        </button>
      </div>
    </div>
  );
}
