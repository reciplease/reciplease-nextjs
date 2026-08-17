import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import Metadata from '@/components/Metadata';
import PhotoCaptureInput from '@/components/scanner/PhotoCaptureInput';
import { apiFetch, useActiveHouse } from '@/lib/houses';
import { toDataUrl } from '@/lib/imageCapture';
import { loadFailedQueue, saveFailedQueue } from '@/lib/shopFailedQueue';

const fetchPending = (url: string): Promise<PendingInventoryItem[]> =>
  apiFetch(url).then((res) => (res.ok ? res.json() : []));

// The fast "add a whole shop" capture loop. Unlike the single-item scan flow,
// the three captures here (barcode, expiration photo, measure photo) are
// independent and order-free — a shopper can do them in whatever order suits
// what they're holding, redo any one of them, and Submit whenever, with
// however many (including zero) filled in. Nothing is digitised here — Submit
// posts a PendingInventoryItem for later processing on /inventory/shop/process,
// so the in-store loop stays as quick as possible. The barcode itself isn't
// decoded here either — only a photo of it is captured, and it's read during
// processing, where the shopper isn't rushing and lighting/framing can be redone.
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

  const [barcodeImage, setBarcodeImage] = useState<string | null>(null);
  const [expirationImage, setExpirationImage] = useState<string | null>(null);
  const [measureImage, setMeasureImage] = useState<string | null>(null);
  // Payloads whose upload failed — kept for retry so a flaky connection in the
  // shop can't silently drop captures. Backed by localStorage (see
  // shopFailedQueue) so a crashed browser, killed phone, or logout doesn't lose
  // them either.
  const [failed, setFailed] = useState<CreatePendingInventoryItem[]>([]);
  // True while a retry sweep (automatic or manual) is in flight, so the banner
  // can show progress instead of a Retry button a second tap would duplicate.
  const [retrying, setRetrying] = useState(false);
  // How many uploads the in-flight retry sweep started with — `failed` itself
  // is cleared up front (each item lands back in it individually if it fails
  // again), so the "Retrying N…" copy needs its own snapshot to display.
  const [retryingCount, setRetryingCount] = useState(0);
  // Uploads still in flight — Done is held back while any are, so a failure on
  // the last capture surfaces as the retry banner instead of being lost by
  // navigating away before it lands.
  const [inflight, setInflight] = useState(0);
  // A 403 means this member can't add items at all — retrying can never help.
  const [forbidden, setForbidden] = useState(false);

  // Hydrate any failed uploads left over from a previous session (crash, kill,
  // logout) as soon as we know which house we're in.
  useEffect(() => {
    if (!activeHouse) return;
    const stored = loadFailedQueue(activeHouse.id);
    // Hydrating from localStorage (an external system) when the house id we
    // need to key it by becomes available — not deriving state from props.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored.length > 0) setFailed(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHouse?.id]);

  useEffect(() => {
    if (!activeHouse) return;
    saveFailedQueue(activeHouse.id, failed);
  }, [activeHouse, failed]);

  // Bumped on every successful upload — a plain counter rather than calling
  // retryFailed directly from submit(), so the auto-retry decision is made
  // from an effect (which always sees the render's real `failed`/`retrying`)
  // instead of a stale closure captured at some earlier, possibly-outdated
  // point in submit's async chain.
  const [successPulse, setSuccessPulse] = useState(0);

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
      setSuccessPulse((count) => count + 1);
    } catch {
      setFailed((prior) => [...prior, payload]);
    } finally {
      setInflight((count) => count - 1);
    }
  }, [mutatePending]);

  function retryFailed() {
    if (failed.length === 0 || retrying) return;
    const toRetry = failed;
    setFailed([]);
    setRetryingCount(toRetry.length);
    setRetrying(true);
    Promise.allSettled(toRetry.map(submit)).finally(() => setRetrying(false));
  }

  // A successful upload (new capture or a retry) is the signal that
  // connectivity is back — use it to clear any backlog automatically rather
  // than waiting for a manual tap. Skipped on the initial mount (pulse
  // starts at 0, so there's nothing to react to yet).
  const isInitialPulse = useRef(true);
  useEffect(() => {
    if (isInitialPulse.current) {
      isInitialPulse.current = false;
      return;
    }
    retryFailed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [successPulse]);

  // Submit is intentionally unvalidated — any subset (including none) of the
  // three captures can be posted, so a shopper never has to backtrack to fill
  // in a step they don't have (no barcode on loose veg, no printed date on
  // some packs).
  function handleSubmit() {
    const payload: CreatePendingInventoryItem = {
      ...(barcodeImage ? { barcodeImage } : {}),
      ...(expirationImage ? { expirationImage } : {}),
      ...(measureImage ? { measureImage } : {}),
    };
    if (Object.keys(payload).length > 0) {
      submit(payload);
    }
    setBarcodeImage(null);
    setExpirationImage(null);
    setMeasureImage(null);
  }

  return (
    <>
      <Metadata title="Add a whole shop" description="Capture a shopping trip for later processing" />

      {/* Standalone full-screen page — no Layout header above us, so apply the
          inventory accent here (the Layout wrapper that normally does it is skipped). */}
      <div className="inventory-theme flex flex-col bg-black text-white h-svh"
           style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-semibold mr-auto">Add a whole shop</h3>
            <div className="bg-zinc-900 rounded-full px-4 py-1.5 text-sm text-zinc-300">
              {savedCount} {savedCount === 1 ? 'item' : 'items'} captured
            </div>
            {/* Small and tucked away from the main thumb zone — ending a capture
                session is rare and hard to undo, so it shouldn't be as easy to
                hit as Submit. */}
            <button
              type="button"
              onClick={() => router.push('/inventory/shop/process')}
              disabled={inflight > 0}
              className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-full disabled:opacity-40"
            >
              {inflight > 0 ? 'Uploading…' : 'Process →'}
            </button>
          </div>

          {forbidden && (
            <p className="text-sm text-red-200 bg-red-950/80 border border-red-800 rounded-lg px-4 py-3">
              You don&apos;t have permission to add items in this house — captures aren&apos;t being saved.
            </p>
          )}

          {(failed.length > 0 || retrying) && (
            <div
              className={`border rounded-lg px-4 py-3 flex items-center justify-between gap-3 ${
                retrying ? 'bg-orange-950/80 border-orange-800' : 'bg-red-950/80 border-red-800'
              }`}
            >
              <p className={`text-sm ${retrying ? 'text-orange-200' : 'text-red-200'}`}>
                {retrying
                  ? `Retrying ${retryingCount} failed ${retryingCount === 1 ? 'upload' : 'uploads'}…`
                  : `${failed.length} ${failed.length === 1 ? 'item' : 'items'} failed to upload.`}
              </p>
              {!retrying && (
                <button
                  type="button"
                  onClick={retryFailed}
                  className="px-4 py-1.5 bg-red-700 text-white text-sm font-semibold rounded-lg hover:bg-red-600"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Barcode capture — each section is a header row (label left,
              capture button floated right via flex) with the result, if
              any, shown beneath. */}
          <div className="grid gap-3 bg-zinc-900 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <h4 className="text-sm font-semibold text-zinc-300 mr-auto">Barcode</h4>
              <PhotoCaptureInput
                label={barcodeImage ? 'Retake barcode photo' : 'Take barcode photo'}
                onCaptured={setBarcodeImage}
                maxDim={800}
                quality={0.85}
              />
            </div>
            {barcodeImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={toDataUrl(barcodeImage)}
                alt="Barcode photo preview"
                className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
              />
            )}
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

          {/* Dominant — this is the button pressed dozens of times per trip. */}
          <button
            type="button"
            onClick={handleSubmit}
            className="w-full px-6 py-4 bg-highlight text-white font-semibold text-lg rounded-lg"
          >
            Submit
          </button>
        </div>

        {/* Footer */}
        <div className="bg-zinc-950 px-6 py-3 flex items-center">
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
