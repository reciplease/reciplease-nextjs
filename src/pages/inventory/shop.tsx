import { useCallback, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import Metadata from '@/components/Metadata';
import PhotoCaptureInput from '@/components/scanner/PhotoCaptureInput';
import { apiFetch, useActiveHouse } from '@/lib/houses';
import { toDataUrl } from '@/lib/imageCapture';

// Load scanner adapters client-side only (they use browser APIs)
const BarcodeScanner = dynamic(() => import('@/components/scanner/BarcodeScanner'), { ssr: false });

const fetchPending = (url: string): Promise<PendingInventoryItem[]> =>
  apiFetch(url).then((res) => (res.ok ? res.json() : []));

// The fast "add a whole shop" capture loop. Unlike the single-item scan flow,
// the three captures here (barcode, expiration photo, measure photo) are
// independent and order-free — a shopper can do them in whatever order suits
// what they're holding, redo any one of them, and Submit whenever, with
// however many (including zero) filled in. Nothing is digitised here — Submit
// posts a PendingInventoryItem for later processing on /inventory/shop/process,
// so the in-store loop stays as quick as possible.
export default function ShopPage() {
  const router = useRouter();

  const activeHouse = useActiveHouse();
  // The count reflects this house's actual pending backlog — including items
  // captured in an earlier session, not just this page load — so it never
  // understates what's queued up for /inventory/shop/process.
  const { data: pendingItems, mutate: mutatePending } = useSWR(
    activeHouse ? ['/api/inventory/pending', activeHouse.id] : null,
    () => fetchPending('/api/inventory/pending'),
  );
  const savedCount = pendingItems?.length ?? 0;

  const [scanningBarcode, setScanningBarcode] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [expirationImage, setExpirationImage] = useState<string | null>(null);
  const [measureImage, setMeasureImage] = useState<string | null>(null);
  // Payloads whose upload failed — kept for retry so a flaky connection in the
  // shop can't silently drop captures.
  const [failed, setFailed] = useState<CreatePendingInventoryItem[]>([]);
  // Uploads still in flight — Done is held back while any are, so a failure on
  // the last capture surfaces as the retry banner instead of being lost by
  // navigating away before it lands.
  const [inflight, setInflight] = useState(0);
  // A 403 means this member can't add items at all — retrying can never help.
  const [forbidden, setForbidden] = useState(false);

  // Uploads fire-and-continue: the next capture starts immediately while the
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
      await mutatePending();
    } catch {
      setFailed((prior) => [...prior, payload]);
    } finally {
      setInflight((count) => count - 1);
    }
  }, [mutatePending]);

  function handleBarcodeDetected(scanned: string) {
    setBarcode(scanned);
    setScanningBarcode(false);
  }

  function handleManualBarcode() {
    const trimmed = manualBarcode.trim();
    if (!trimmed) return;
    setManualBarcode('');
    handleBarcodeDetected(trimmed);
  }

  // Submit is intentionally unvalidated — any subset (including none) of the
  // three captures can be posted, so a shopper never has to backtrack to fill
  // in a step they don't have (no barcode on loose veg, no printed date on
  // some packs).
  function handleSubmit() {
    const payload: CreatePendingInventoryItem = {
      ...(barcode ? { barcode } : {}),
      ...(expirationImage ? { expirationImage } : {}),
      ...(measureImage ? { measureImage } : {}),
    };
    if (Object.keys(payload).length > 0) {
      submit(payload);
    }
    setBarcode('');
    setExpirationImage(null);
    setMeasureImage(null);
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

        {scanningBarcode ? (
          <>
            {/* Camera view — fills remaining space */}
            <div className="relative flex-1 overflow-hidden bg-zinc-950 min-h-64">
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/55 rounded-full px-5 py-1.5 pointer-events-none z-10">
                <span className="text-sm font-semibold whitespace-nowrap">Scan barcode</span>
              </div>
              <BarcodeScanner active onDetected={handleBarcodeDetected} />
            </div>

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
                onClick={() => setScanningBarcode(false)}
                className="self-start text-zinc-400 text-sm hover:text-white"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-xl font-semibold mr-auto">Add a whole shop</h3>
              <div className="bg-zinc-900 rounded-full px-4 py-1.5 text-sm text-zinc-300">
                {savedCount} {savedCount === 1 ? 'item' : 'items'} captured
              </div>
            </div>

            {forbidden && (
              <p className="text-sm text-red-200 bg-red-950/80 border border-red-800 rounded-lg px-4 py-3">
                You don&apos;t have permission to add items in this house — captures aren&apos;t being saved.
              </p>
            )}

            {failed.length > 0 && (
              <div className="bg-red-950/80 border border-red-800 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
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

            {/* Barcode capture — each section is a header row (label left,
                capture button floated right via flex) with the result, if
                any, shown beneath. */}
            <div className="grid gap-3 bg-zinc-900 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <h4 className="text-sm font-semibold text-zinc-300 mr-auto">Barcode</h4>
                <button
                  type="button"
                  onClick={() => setScanningBarcode(true)}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold rounded-lg whitespace-nowrap"
                >
                  {barcode ? 'Rescan' : 'Scan barcode'}
                </button>
              </div>
              {barcode && <p className="font-mono text-sm text-zinc-200">{barcode}</p>}
            </div>

            {/* Expiration photo capture */}
            <div className="grid gap-3 bg-zinc-900 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <h4 className="text-sm font-semibold text-zinc-300 mr-auto">Expiration date</h4>
                <PhotoCaptureInput
                  label={expirationImage ? 'Retake picture of expiration' : 'Take picture of expiration'}
                  onCaptured={setExpirationImage}
                />
              </div>
              {expirationImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={toDataUrl(expirationImage)}
                  alt="Expiration photo preview"
                  className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
                />
              )}
            </div>

            {/* Measure photo capture */}
            <div className="grid gap-3 bg-zinc-900 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <h4 className="text-sm font-semibold text-zinc-300 mr-auto">Measure</h4>
                <PhotoCaptureInput
                  label={measureImage ? 'Retake picture of measure' : 'Take picture of measure'}
                  onCaptured={setMeasureImage}
                />
              </div>
              {measureImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={toDataUrl(measureImage)}
                  alt="Measure photo preview"
                  className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
                />
              )}
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              className="px-6 py-2.5 bg-highlight text-white font-semibold rounded-lg"
            >
              Submit
            </button>
          </div>
        )}

        {/* Footer */}
        {!scanningBarcode && (
          <div className="bg-zinc-950 px-6 py-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => router.push('/inventory')}
              className="text-zinc-500 text-sm hover:text-white"
            >
              ← Back to inventory
            </button>
            <button
              type="button"
              onClick={() => router.push('/inventory/shop/process')}
              disabled={inflight > 0}
              className="px-6 py-2.5 bg-highlight text-white font-semibold rounded-lg disabled:opacity-40"
            >
              {inflight > 0 ? 'Uploading…' : 'Process captured items'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
