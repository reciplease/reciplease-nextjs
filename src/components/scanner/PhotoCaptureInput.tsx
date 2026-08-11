import { compressToBase64 } from '@/lib/imageCapture';

type Props = {
  label: string;
  onCaptured: (base64: string) => void;
};

// Camera/file input that compresses the chosen photo to a small base64 JPEG (the
// format items store in Mongo). `capture="environment"` opens the back camera
// directly on mobile; on desktop it falls back to a file picker. The native
// `<input type="file">` is visually unstyleable, so it's hidden (`sr-only`)
// behind a real button — the label wrapping it keeps it keyboard/click
// accessible and gives screen readers the same accessible name.
export default function PhotoCaptureInput({ label, onCaptured }: Props) {
  async function handleFile(file: File) {
    try {
      onCaptured(await compressToBase64(file));
    } catch {
      // Ignore — the user can just try again or skip the photo.
    }
  }

  return (
    <label className="inline-flex items-center gap-2 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold rounded-lg cursor-pointer whitespace-nowrap">
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
           strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
        <path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h7l1 1.5H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
      {label}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
        className="sr-only"
      />
    </label>
  );
}
