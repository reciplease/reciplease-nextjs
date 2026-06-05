import { useEffect, useRef } from 'react';

type Props = {
  active: boolean;
  onDetected: (barcode: string) => void;
};

/**
 * I/O adapter — owns the camera stream and ZXing decode loop.
 * Fires onDetected(barcode) once when a barcode is read, then stops.
 * Not unit tested; covered by manual / integration testing.
 */
export default function BarcodeScanner({ active, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<any>(null);

  useEffect(() => {
    if (!active) {
      readerRef.current?.reset();
      return;
    }

    let alive = true;
    let stream: MediaStream | null = null;

    async function start() {
      if (!videoRef.current) return;

      // 1. Acquire camera
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
      } catch {
        return; // Camera unavailable — silently degrade
      }
      if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }

      // 2. Attach stream and wait for video to be playing
      const video = videoRef.current;
      video.srcObject = stream;
      try { await video.play(); } catch { /* autoplay policy — playsInline muted should allow it */ }
      if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }

      // 3. Start ZXing continuous decode — video is guaranteed to have a live stream now
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader() as any;
      readerRef.current = reader;
      try {
        // decodeFromVideoElementContinuously polls every frame until reset() is called.
        // The callback receives (result, error) — error just means "no barcode this frame".
        reader.decodeFromVideoElementContinuously(
          video,
          (result: import('@zxing/library').Result | undefined, err: unknown) => {
            if (!alive) return;
            if (err) return; // no barcode in this frame — keep scanning
            if (!result) return;
            reader.reset();
            alive = false;
            onDetected(result.getText());
          },
        );
      } catch {
        // unexpected setup errors
      }
    }

    start();
    return () => {
      alive = false;
      readerRef.current?.reset();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active, onDetected]);

  return (
    <div className="relative w-full h-full">
      <video ref={videoRef} className="w-full h-full object-cover block" autoPlay playsInline muted />
      {/* Targeting reticle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-24 border-2 border-white/60 rounded-lg pointer-events-none">
        <span className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-[3px] border-l-[3px] border-sky-400 rounded-tl" />
        <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-[3px] border-r-[3px] border-sky-400 rounded-br" />
      </div>
    </div>
  );
}
