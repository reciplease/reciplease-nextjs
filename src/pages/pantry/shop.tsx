import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Metadata from '@/components/Metadata';
import PhotoCaptureInput from '@/components/scanner/PhotoCaptureInput';
import { useActiveHouse } from '@/lib/houses';
import { toDataUrl } from '@/lib/imageCapture';
import { migrateFailedQueue } from '@/lib/shopFailedQueue';
import { addCapture, EMPTY_DRAFT, listCaptures, loadDraft, saveDraft, type ShopDraft } from '@/lib/shopOutbox';
import { useFindAllPendingPantryItems } from '@/types/generated/client';
import { isSuccessResponse } from '@/lib/apiClientMutator';

const UPLOAD_RETRY_MS = 15000;

type SyncCapableRegistration = ServiceWorkerRegistration & {
  sync?: { register(tag: string): Promise<void> };
};

async function requestUpload() {
  if (!('serviceWorker' in navigator)) return;
  const registration = (await navigator.serviceWorker.ready) as SyncCapableRegistration;
  registration.active?.postMessage({ type: 'flush-shop' });
  await registration.sync?.register('shop-upload').catch(() => {});
}

export default function ShopPage() {
  const router = useRouter();

  const activeHouse = useActiveHouse();
  const houseId = activeHouse?.id;
  const forbidden = Boolean(activeHouse) && activeHouse?.role !== 'OWNER';

  const { data: pendingItemsResponse, mutate: mutatePending } = useFindAllPendingPantryItems({
    swr: { enabled: Boolean(activeHouse) },
  });
  const pendingItems =
    pendingItemsResponse && isSuccessResponse(pendingItemsResponse) ? pendingItemsResponse.data : undefined;
  const savedCount = pendingItems?.length ?? 0;

  const [draft, setDraft] = useState<ShopDraft>(EMPTY_DRAFT);
  const [draftHouseId, setDraftHouseId] = useState<string | null>(null);
  const [waitingCount, setWaitingCount] = useState(0);
  const [saveFailed, setSaveFailed] = useState(false);
  const { barcodeImage, expirationImage, measureImage } = draft;
  const capturePhoto = (field: keyof ShopDraft) => (image: string) =>
    setDraft((prior) => ({ ...prior, [field]: image }));

  const refreshWaiting = useCallback(async () => {
    if (!houseId) return;
    setWaitingCount((await listCaptures(houseId)).length);
  }, [houseId]);

  useEffect(() => {
    if (!houseId) return;
    let cancelled = false;
    (async () => {
      try {
        await migrateFailedQueue(houseId);
        const stored = await loadDraft(houseId);
        if (cancelled) return;
        setDraft((prior) => ({
          barcodeImage: prior.barcodeImage ?? stored.barcodeImage,
          expirationImage: prior.expirationImage ?? stored.expirationImage,
          measureImage: prior.measureImage ?? stored.measureImage,
        }));
        await refreshWaiting();
      } catch {
        setSaveFailed(true);
      }
      if (!cancelled) setDraftHouseId(houseId);
    })();
    return () => {
      cancelled = true;
    };
  }, [houseId, refreshWaiting]);

  useEffect(() => {
    if (!houseId || draftHouseId !== houseId) return;
    saveDraft(houseId, draft).catch(() => {});
  }, [houseId, draftHouseId, draft]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'shop-outbox-changed') return;
      refreshWaiting();
      mutatePending();
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [refreshWaiting, mutatePending]);

  useEffect(() => {
    if (waitingCount === 0) return;
    requestUpload();
    const retryTimer = setInterval(requestUpload, UPLOAD_RETRY_MS);
    window.addEventListener('online', requestUpload);
    return () => {
      clearInterval(retryTimer);
      window.removeEventListener('online', requestUpload);
    };
  }, [waitingCount]);

  async function handleSubmit() {
    if (!houseId || forbidden) return;
    const submitted = draft;
    if (!barcodeImage && !expirationImage && !measureImage) return;
    setDraft(EMPTY_DRAFT);
    try {
      await addCapture({
        scanId: crypto.randomUUID(),
        houseId,
        capturedAt: Date.now(),
        ...(barcodeImage ? { barcodeImage } : {}),
        ...(expirationImage ? { expirationImage } : {}),
        ...(measureImage ? { measureImage } : {}),
      });
      setSaveFailed(false);
      await refreshWaiting();
    } catch {
      setDraft(submitted);
      setSaveFailed(true);
    }
  }

  return (
    <>
      <Metadata title="Add a whole shop" description="Capture a shopping trip for later processing" />

      {/* Standalone full-screen page — no Layout header above us, so apply the
          pantry accent here (the Layout wrapper that normally does it is skipped). */}
      <div className="pantry-theme flex flex-col bg-black text-white h-svh"
           style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-semibold mr-auto">Add a whole shop</h3>
            <div className="bg-zinc-900 rounded-full px-4 py-1.5 text-sm text-zinc-300">
              {savedCount + waitingCount} {savedCount + waitingCount === 1 ? 'item' : 'items'} captured
            </div>
            {/* Small and tucked away from the main thumb zone — ending a capture
                session is rare and hard to undo, so it shouldn't be as easy to
                hit as Submit. */}
            <button
              type="button"
              onClick={() => router.push('/pantry/shop/process')}
              className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-full"
            >
              Process →
            </button>
          </div>

          {forbidden && (
            <p className="text-sm text-red-200 bg-red-950/80 border border-red-800 rounded-lg px-4 py-3">
              You don&apos;t have permission to add items in this house — captures aren&apos;t being saved.
            </p>
          )}

          {saveFailed && (
            <p className="text-sm text-red-200 bg-red-950/80 border border-red-800 rounded-lg px-4 py-3">
              Couldn&apos;t save this capture on your device — storage may be full or unavailable.
            </p>
          )}

          {waitingCount > 0 && (
            <div className="border rounded-lg px-4 py-3 flex items-center justify-between gap-3 bg-orange-950/80 border-orange-800">
              <p className="text-sm text-orange-200">
                {waitingCount} {waitingCount === 1 ? 'item' : 'items'} saved on this device, waiting to upload.
              </p>
              <button
                type="button"
                onClick={requestUpload}
                className="px-4 py-1.5 bg-orange-700 text-white text-sm font-semibold rounded-lg hover:bg-orange-600"
              >
                Upload now
              </button>
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
                onCaptured={capturePhoto('barcodeImage')}
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
                onCaptured={capturePhoto('expirationImage')}
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
                onCaptured={capturePhoto('measureImage')}
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
            disabled={forbidden}
            className="w-full px-6 py-4 bg-highlight text-white font-semibold text-lg rounded-lg disabled:opacity-40"
          >
            Submit
          </button>
        </div>

        {/* Footer */}
        <div className="bg-zinc-950 px-6 py-3 flex items-center">
          <button
            type="button"
            onClick={() => router.push('/pantry')}
            className="text-zinc-400 text-sm hover:text-white"
          >
            ← Back to pantry
          </button>
        </div>
      </div>
    </>
  );
}
