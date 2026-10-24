import { useState, useSyncExternalStore } from 'react';
import { compressToBase64 } from '@/lib/imageCapture';
import WebcamCapture from '@/components/scanner/WebcamCapture';

type Props = {
  label: string;
  onCaptured: (base64: string) => void;
  maxDim?: number;
  quality?: number;
};

const BUTTON_CLASS =
  'inline-flex items-center gap-2 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold rounded-lg cursor-pointer whitespace-nowrap';

const subscribeToNothing = () => () => {};

function hasWebcamInsteadOfCameraApp(): boolean {
  return !window.matchMedia('(pointer: coarse)').matches && Boolean(navigator.mediaDevices?.getUserMedia);
}

function CameraIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h7l1 1.5H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export default function PhotoCaptureInput({ label, onCaptured, maxDim, quality }: Props) {
  const webcamAvailable = useSyncExternalStore(subscribeToNothing, hasWebcamInsteadOfCameraApp, () => false);
  const [webcamOpen, setWebcamOpen] = useState(false);

  async function handlePhoto(photo: File | Blob) {
    try {
      onCaptured(await compressToBase64(photo, maxDim, quality));
    } catch {
      return;
    }
  }

  const fileInput = (
    <input
      type="file"
      aria-label={webcamAvailable ? `${label} from a file` : undefined}
      accept="image/*"
      capture="environment"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handlePhoto(file);
        e.target.value = '';
      }}
      className="sr-only"
    />
  );

  if (!webcamAvailable) {
    return (
      <label className={BUTTON_CLASS}>
        <CameraIcon />
        {label}
        {fileInput}
      </label>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => setWebcamOpen(true)} className={BUTTON_CLASS}>
        <CameraIcon />
        {label}
      </button>
      <label className="text-xs text-zinc-400 hover:text-white underline cursor-pointer whitespace-nowrap">
        Choose file
        {fileInput}
      </label>
      {webcamOpen && (
        <WebcamCapture
          onClose={() => setWebcamOpen(false)}
          onCapture={(photo) => {
            setWebcamOpen(false);
            handlePhoto(photo);
          }}
        />
      )}
    </div>
  );
}
