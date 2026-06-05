import { useEffect, useRef, useState } from 'react';
import { parseDate } from '@/lib/parseDate';

type Props = {
  active: boolean;
  onDetected: (isoDate: string) => void;
};

/**
 * I/O adapter — owns the Tesseract OCR loop over the camera stream.
 * Fires onDetected(isoDate) once two consecutive frames agree on the same date.
 * Not unit tested; covered by manual / integration testing.
 */
export default function ExpirationScanner({ active, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<import('tesseract.js').Worker | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCandidateRef = useRef<string | null>(null);
  const countRef = useRef(0);
  const [candidate, setCandidate] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      clearInterval(intervalRef.current ?? undefined);
      workerRef.current?.terminate();
      return;
    }
    let alive = true;

    async function init() {
      // Acquire camera first, attach to video, wait for it to play
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
      } catch {
        return; // Camera unavailable
      }

      if (!videoRef.current || !alive) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const video = videoRef.current;
      video.srcObject = stream;
      // Wait for video to be playing before starting OCR
      await new Promise<void>((resolve) => {
        if (video.readyState >= 3) { resolve(); return; }
        video.addEventListener('canplay', () => resolve(), { once: true });
      });

      if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }

      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      workerRef.current = worker;

      intervalRef.current = setInterval(async () => {
        if (!alive || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx || video.readyState < 2) return;

        // Crop the centre horizontal strip where dates typically appear
        const sw = video.videoWidth;
        const sh = Math.round(video.videoHeight * 0.25);
        const sy = Math.round(video.videoHeight * 0.375);
        canvas.width = sw;
        canvas.height = sh;
        ctx.drawImage(video, 0, sy, sw, sh, 0, 0, sw, sh);

        try {
          const { data: { text } } = await worker.recognize(canvas);
          if (!alive) return;
          const found = parseDate(text);
          if (found) {
            if (found === lastCandidateRef.current) {
              countRef.current += 1;
              setCandidate(found);
              if (countRef.current >= 2) {
                clearInterval(intervalRef.current!);
                worker.terminate();
                alive = false;
                onDetected(found);
              }
            } else {
              lastCandidateRef.current = found;
              countRef.current = 1;
              setCandidate(found);
            }
          }
        } catch {
          // ignore OCR errors
        }
      }, 1500);

      return () => stream.getTracks().forEach((t) => t.stop());
    }

    init();
    return () => {
      alive = false;
      clearInterval(intervalRef.current ?? undefined);
      workerRef.current?.terminate();
    };
  }, [active, onDetected]);

  return (
    <div className="relative w-full h-full">
      <video ref={videoRef} className="w-full h-full object-cover block" autoPlay playsInline muted />
      <canvas ref={canvasRef} className="hidden" />
      {/* Scan strip overlay */}
      <div className="absolute top-[37.5%] left-0 right-0 h-[25%] border-t-2 border-b-2 border-sky-400/70 flex items-end pb-1.5 px-3 pointer-events-none">
        <span className="text-sky-400 text-xs bg-black/45 px-2 py-0.5 rounded">
          {candidate ? `Detected: ${candidate}` : 'Looking for date…'}
        </span>
      </div>
    </div>
  );
}
