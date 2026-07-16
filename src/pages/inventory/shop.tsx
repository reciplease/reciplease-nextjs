import { useCallback, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import Metadata from '@/components/Metadata';
import PhotoCaptureInput from '@/components/scanner/PhotoCaptureInput';
import { apiFetch } from '@/lib/houses';

// Load scanner adapters client-side only (they use browser APIs)
const BarcodeScanner = dynamic(() => import('@/components/scanner/BarcodeScanner'), { ssr: false });

type ShopPhase = 'barcode' | 'expirationPhoto' | 'measurePhoto';

const PHASE_LABEL: Record<ShopPhase, string> = {
  barcode: 'Scan barcode',
  expirationPhoto: 'Photo of expiration date',
  measurePhoto: 'Photo of measure',
};

// The fast "add a whole shop" capture loop: scan barcode → photo of the printed
// expiration date → photo of the pack measure/size → repeat. Nothing is digitised
// here — each iteration posts a PendingInventoryItem for later processing on
// /inventory/shop/process, so the in-store loop stays as quick as possible. Every
// step is skippable (no barcode on loose veg, no printed date on some packs).
export default function ShopPage() {
  const router = useRouter();

  const [phase, setPhase] = useState<ShopPhase>('barcode');
  const [barcode, setBarcode] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [expirationImage, setExpirationImage] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  // Payloads whose upload failed — kept for retry so a flaky connection in the
  // shop can't silently drop captures.
  const [failed, setFailed] = useState<CreatePendingInventoryItem[]>([]);
  // Uploads still in flight — Done is held back while any are, so a failure on
  // the last capture surfaces as the retry banner instead of being lost by
  // navigating away before it lands.
  const [inflight, setInflight] = useState(0);
  // A 403 means this member can't add items at all — retrying can never help.
  const [forbidden, setForbidden] = useState(false);

  // Uploads fire-and-continue: the next scan starts immediately while the
  // (small) payload uploads in the background.
  const submit = useCallback(async (payload: CreatePendingInventoryItem) => {
    setInflight((count) => count + 1);
    try {
      const res = await apiFetch('/api/inventory/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) throw new Error('upload failed');
      setSavedCount((count) => count + 1);
    } catch {
      setFailed((prior) => [...prior, payload]);
    } finally {
      setInflight((count) => count - 1);
    }
  }, []);

  function handleBarcodeDetected(scanned: string) {
    setBarcode(scanned);
    setPhase('expirationPhoto');
  }

  function handleManualBarcode() {
    const trimmed = manualBarcode.trim();
    if (!trimmed) return;
    setManualBarcode('');
    handleBarcodeDetected(trimmed);
  }

  function handleExpirationPhoto(image: string | null) {
    setExpirationImage(image);
    setPhase('measurePhoto');
  }

  // The measure photo is the last step of an iteration: build the payload,
  // kick off the upload, and loop straight back to scanning.
  function handleMeasurePhoto(image: string | null) {
    const payload: CreatePendingInventoryItem = {
      ...(barcode ? { barcode } : {}),
      ...(expirationImage ? { expirationImage } : {}),
      ...(image ? { measureImage: image } : {}),
    };
    // Skipping every step captures nothing — there'd be nothing to digitise,
    // so don't create (or count) an empty pending item.
    if (Object.keys(payload).length > 0) {
      submit(payload);
    }
    setBarcode('');
    setExpirationImage(null);
    setPhase('barcode');
  }

  function retryFailed() {
    const toRetry = failed;
    setFailed([]);
    toRetry.forEach(submit);
  }

  return (
    <>
      <Metadata title="Add a whole shop" description="Capture a shopping trip for later processing" />

      {/* Standalone full-screen page — no Layout header above us, so apply the
          inventory accent here (the Layout wrapper that normally does it is skipped). */}
      <div className="inventory-theme flex flex-col bg-black text-white h-svh"
           style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

        {/* Camera view — fills remaining space */}
        <div className="relative flex-1 overflow-hidden bg-zinc-950 min-h-64">

          {/* Phase pill — keyed span re-triggers the entrance animation on change. */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/55 rounded-full px-5 py-1.5 pointer-events-none z-10 overflow-hidden">
            <span key={phase} className="fade-rise-in block text-sm font-semibold whitespace-nowrap">
              {PHASE_LABEL[phase]}
            </span>
          </div>

          {/* Running count — the whole point of the loop is volume, so keep score. */}
          <div className="absolute top-4 right-4 bg-black/55 rounded-full px-4 py-1.5 pointer-events-none z-10 text-sm text-zinc-300">
            {savedCount} {savedCount === 1 ? 'item' : 'items'} captured
          </div>

          {phase === 'barcode' && (
            <BarcodeScanner active onDetected={handleBarcodeDetected} />
          )}
          {phase !== 'barcode' && (
            <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-600 text-sm">
              Camera paused
            </div>
          )}
        </div>

        {forbidden && (
          <div className="bg-red-950/80 border-t border-red-800 px-6 py-3">
            <p className="text-sm text-red-200">
              You don&apos;t have permission to add items in this house — captures aren&apos;t being saved.
            </p>
          </div>
        )}

        {/* Failed uploads — keep them retryable rather than silently dropping. */}
        {failed.length > 0 && (
          <div className="bg-red-950/80 border-t border-red-800 px-6 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-red-200">
              {failed.length} {failed.length === 1 ? 'item' : 'items'} failed to upload.
            </p>
            <button
              type="button"
              onClick={retryFailed}
              className="px-4 py-1.5 bg-red-700 text-white text-sm font-semibold rounded-lg hover:bg-red-600"
            >
              Retry
            </button>
          </div>
        )}

        {phase === 'barcode' && (
          <div className="bg-zinc-900 px-6 py-4 flex flex-col gap-3">
            <label htmlFor="shop-manual-barcode" className="text-xs text-zinc-400">
              Or enter a barcode manually
            </label>
            <div className="flex gap-3 flex-wrap">
              <input
                id="shop-manual-barcode"
                inputMode="numeric"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleManualBarcode(); }}
                placeholder="e.g. 5012345678900"
                className="flex-1 min-w-0 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-highlight"
              />
              <button
                type="button"
                onClick={handleManualBarcode}
                disabled={!manualBarcode.trim()}
                className="px-5 py-2 bg-highlight text-white font-semibold rounded-lg disabled:opacity-40"
              >
                Use barcode
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPhase('expirationPhoto')}
              className="self-start text-zinc-400 text-sm hover:text-white"
            >
              No barcode → photos only
            </button>
            <button
              type="button"
              onClick={() => router.push('/inventory/shop/process')}
              disabled={inflight > 0}
              className="px-6 py-2.5 bg-highlight text-white font-semibold rounded-lg disabled:opacity-40"
            >
              {inflight > 0
                ? 'Uploading…'
                : `Done — process ${savedCount > 0 ? `${savedCount} ` : ''}captured ${savedCount === 1 ? 'item' : 'items'}`}
            </button>
          </div>
        )}

        {(phase === 'expirationPhoto' || phase === 'measurePhoto') && (
          <div className="bg-zinc-900 px-6 py-6 flex flex-col gap-4">
            {barcode && <p className="text-xs text-zinc-500">Barcode: {barcode}</p>}
            <PhotoCaptureInput
              label={PHASE_LABEL[phase]}
              onCaptured={(image) =>
                phase === 'expirationPhoto' ? handleExpirationPhoto(image) : handleMeasurePhoto(image)
              }
            />
            <button
              type="button"
              onClick={() =>
                phase === 'expirationPhoto' ? handleExpirationPhoto(null) : handleMeasurePhoto(null)
              }
              className="self-start px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 text-sm"
            >
              Skip
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="bg-zinc-950 px-6 py-3">
          <button
            type="button"
            onClick={() => router.push('/inventory')}
            className="text-zinc-500 text-sm hover:text-white"
          >
            ← Back to inventory
          </button>
        </div>
      </div>
    </>
  );
}
