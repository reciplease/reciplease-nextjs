import { compressToBase64 } from '@/lib/imageCapture';

type Props = {
  label: string;
  onCaptured: (base64: string) => void;
};

// Camera/file input that compresses the chosen photo to a small base64 JPEG (the
// format items store in Mongo). `capture="environment"` opens the back camera
// directly on mobile; on desktop it falls back to a file picker.
export default function PhotoCaptureInput({ label, onCaptured }: Props) {
  async function handleFile(file: File) {
    try {
      onCaptured(await compressToBase64(file));
    } catch {
      // Ignore — the user can just try again or skip the photo.
    }
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-zinc-400">{label}</span>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
        className="text-sm text-zinc-300"
      />
    </label>
  );
}
