import { useEffect, useRef } from 'react';

type Props = {
  active: boolean;
  onDetected: (barcode: string) => void;
};

/**
 * I/O adapter — owns the ZXing decode loop.
 * decodeFromVideoDevice handles getUserMedia + stream attachment + continuous scan.
 * Fires onDetected(barcode) once when a barcode is read, then stops.
 * Not unit tested; covered by manual / integration testing.
 */
export default function BarcodeScanner({ active, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!active || !videoRef.current) return;

    // controls is set asynchronously; use a ref so the cleanup can call stop()
    // even if the effect cleans up before decodeFromVideoDevice resolves.
    let controls: { stop: () => void } | null = null;
    let stopped = false;

    async function start() {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      if (stopped || !videoRef.current) return;
      try {
        controls = await reader.decodeFromVideoDevice(
          // undefined = use environment-facing camera (back camera on phones)
          undefined,
          videoRef.current,
          (result, err) => {
            if (err || !result) return; // no barcode this frame — keep scanning
            controls?.stop();
            onDetected(result.getText());
          },
        );
        if (stopped) controls.stop();
      } catch {
        // camera access denied or setup error — silently degrade
      }
    }

    start();
    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [active, onDetected]);

  return (
    <div className="relative w-full h-full">
      {/* ZXing attaches the stream to this element via decodeFromVideoDevice */}
      <video ref={videoRef} className="w-full h-full object-cover block" autoPlay playsInline muted />
      {/* Targeting reticle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-24 border-2 border-white/60 rounded-lg pointer-events-none">
        <span className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-[3px] border-l-[3px] border-highlight rounded-tl" />
        <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-[3px] border-r-[3px] border-highlight rounded-br" />
      </div>
    </div>
  );
}
