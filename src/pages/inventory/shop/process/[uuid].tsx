import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import useSWR from 'swr';
import Metadata from '@/components/Metadata';
import MdyDateInput from '@/components/MdyDateInput';
import MeasureAmountFields from '@/components/scanner/MeasureAmountFields';
import CandidatePills from '@/components/scanner/CandidatePills';
import PhotoCaptureInput from '@/components/scanner/PhotoCaptureInput';
import InventoryImage from '@/components/InventoryImage';
import { suggestItemFromBarcode } from '@/lib/suggestItemFromBarcode';
import { compressToBase64, toDataUrl } from '@/lib/imageCapture';
import { apiFetch, useActiveHouse } from '@/lib/houses';
import { useMeasures } from '@/lib/measures';
import { toIsoDate } from '@/lib/week';

const fetcher = (url: string): Promise<PendingInventoryItem> =>
  apiFetch(url).then((res) => {
    if (!res.ok) throw new Error('Not found');
    return res.json();
  });

// Where to go after finishing one item: the next item still in the backlog
// (excluding the one we just completed, in case the list hasn't caught up
// yet), or back to the list once nothing's left.
async function nextDestination(justCompletedUuid: string): Promise<string> {
  const remaining: PendingInventoryItem[] = await apiFetch('/api/inventory/pending')
    .then((res) => (res.ok ? res.json() : []))
    .catch(() => []);
  const next = remaining.find((item) => item.uuid !== justCompletedUuid);
  return next ? `/inventory/shop/process/${next.uuid}` : '/inventory/shop/process';
}

// A captured photo shown at digitising size, next to the input that digitises
// it — the whole point of this page is transcribing what's in the picture.
function CapturedPhoto({ image, alt }: { image?: string; alt: string }) {
  if (!image) {
    return (
      <div className="w-full max-w-xs aspect-[4/3] rounded-lg bg-zinc-800 flex items-center justify-center text-sm text-zinc-500">
        No photo captured
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={toDataUrl(image)} alt={alt} className="w-full max-w-xs rounded-lg object-contain" />;
}

export default function ProcessDetailPage() {
  const router = useRouter();
  const uuid = router.query.uuid as string | undefined;
  const activeHouse = useActiveHouse();
  const { data: pending, error, isLoading } = useSWR(
    uuid && activeHouse ? [`/api/inventory/pending/${uuid}`, activeHouse.id] : null,
    () => fetcher(`/api/inventory/pending/${uuid}`),
  );

  if (!router.isReady || !activeHouse || isLoading) {
    return (
      <>
        <Metadata title="Loading" description="Loading pending item..." />
        <p>Loading...</p>
      </>
    );
  }

  if (error || !pending || !uuid) {
    return (
      <>
        <Metadata title="Not Found" description="Pending item not found" />
        <p>This item has already been processed or discarded.</p>
        <Link href="/inventory/shop/process" className="underline">Back to the list</Link>
      </>
    );
  }

  return <ProcessForm uuid={uuid} pending={pending} />;
}

// Mounted only once the pending item has loaded, so state can initialize from
// it directly (same pattern as the inventory edit page's EditForm).
function ProcessForm({ uuid, pending }: { uuid: string; pending: PendingInventoryItem }) {
  const router = useRouter();
  const measures = useMeasures();

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [candidates, setCandidates] = useState<string[]>([]);
  const [brandCandidates, setBrandCandidates] = useState<string[]>([]);
  const [suggestedMeasureId, setSuggestedMeasureId] = useState<string | null>(null);
  const [measure, setMeasure] = useState<Measure | null>(null);
  const [amount, setAmount] = useState('');
  const [expiration, setExpiration] = useState(toIsoDate(new Date()));
  // Raw base64 JPEG for the item itself — from an OpenFoodFacts product photo
  // or a manually taken one. Best-effort, like the single-item scan flow.
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The barcode itself is decoded here, not during capture — this is where the
  // shopper isn't rushing and a bad photo (blur, glare, bad framing) can be
  // retaken or typed in manually instead. `null` = not decoded (yet, or ever);
  // an explicit manual entry always wins once typed. Seeded from legacyBarcode
  // for items captured before the photo-based flow existed — those never got
  // a barcodeImage to decode, so there's nothing to run zxing against below.
  const [decodedBarcode, setDecodedBarcode] = useState<string | null>(pending.legacyBarcode ?? null);
  const [decodeFailed, setDecodeFailed] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const barcode = manualBarcode.trim() || decodedBarcode || undefined;

  useEffect(() => {
    if (!pending.barcodeImage) return;
    let cancelled = false;
    import('@zxing/browser').then(({ BrowserMultiFormatReader }) =>
      new BrowserMultiFormatReader().decodeFromImageUrl(toDataUrl(pending.barcodeImage!)),
    )
      .then((result) => {
        if (!cancelled) setDecodedBarcode(result.getText());
      })
      .catch(() => {
        if (!cancelled) setDecodeFailed(true);
      });
    return () => { cancelled = true; };
  }, [pending.barcodeImage]);

  // Suggest a name/measure from the barcode (prior inventory, then
  // OpenFoodFacts) — the capture loop deferred all lookups to here.
  useEffect(() => {
    if (!barcode) return;
    let cancelled = false;
    suggestItemFromBarcode(barcode).then((suggestion) => {
      if (cancelled) return;
      setName((prior) => prior || suggestion.name);
      setBrand((prior) => prior || suggestion.brand);
      setCandidates(suggestion.candidates);
      setBrandCandidates(suggestion.brandCandidates);
      setSuggestedMeasureId(suggestion.measureId);
      // Fetch and compress the product photo in the background — a failed or
      // CORS-blocked fetch never blocks digitising.
      if (suggestion.imageUrl) {
        fetch(suggestion.imageUrl)
          .then((res) => {
            if (!res.ok) throw new Error('Failed to fetch image');
            return res.blob();
          })
          .then((blob) => compressToBase64(blob))
          .then((base64) => {
            if (!cancelled) setImage((prior) => prior ?? base64);
          })
          .catch(() => {});
      }
    });
    return () => { cancelled = true; };
  }, [barcode]);

  // Measures load independently of the suggestion, so the suggested measure is
  // derived rather than stored: it applies until the user explicitly picks one.
  const effectiveMeasure =
    measure ?? measures.find((m) => m.measureId === suggestedMeasureId) ?? null;

  const missingFields = !name.trim() || !effectiveMeasure || !amount || !expiration;

  async function handleComplete() {
    if (!name.trim() || !effectiveMeasure || !amount || !expiration) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: CreateInventoryItem = {
        name: name.trim(),
        measure: effectiveMeasure.measureId,
        amount: parseFloat(amount),
        expiration,
        ...(brand.trim() ? { brand: brand.trim() } : {}),
        ...(barcode ? { barcode } : {}),
        ...(image ? { image } : {}),
      };
      const res = await apiFetch(`/api/inventory/pending/${uuid}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError('Failed to add the item. Please try again.');
        return;
      }
      // Straight on to the next item in the backlog rather than back to the
      // list — digitising is usually a full sweep of everything captured in
      // one trip, so returning to the list after each one would just mean
      // immediately tapping back in.
      router.push(await nextDestination(uuid));
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDiscard() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/inventory/pending/${uuid}`, { method: 'DELETE' });
      if (!res.ok) {
        setError('Failed to discard. Please try again.');
        return;
      }
      router.push('/inventory/shop/process');
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Metadata title="Process item" description="Digitise a captured shop item" />

      {/* Dark card matching the scanner pages: photos of packaging read better
          on the same background they were reviewed against during capture.
          No max-width — fills the column like the rest of the app instead of
          leaving a mostly-empty page around a narrow card. */}
      <section className="grid gap-8 rounded-xl bg-zinc-900 text-white p-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Small and top-left — this ends the current sweep through the
              backlog, so it shouldn't compete with Add to inventory. */}
          <button
            type="button"
            onClick={() => router.push('/inventory/shop/process')}
            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-full"
          >
            ← Back to shop
          </button>
          <h3 className="text-xl font-semibold mr-auto">Process item</h3>
          {decodedBarcode && !manualBarcode && <p className="font-mono text-xs text-zinc-400">{decodedBarcode}</p>}
        </div>

        {pending.barcodeImage && (
          <div className="grid gap-3">
            <h4 className="text-sm font-semibold text-zinc-300">Barcode</h4>
            <CapturedPhoto image={pending.barcodeImage} alt="Barcode photo" />
            {decodeFailed && (
              <div className="grid gap-1.5">
                <label htmlFor="process-manual-barcode" className="text-xs text-zinc-400">
                  Couldn&apos;t read the barcode automatically — enter it manually
                </label>
                <input
                  id="process-manual-barcode"
                  inputMode="numeric"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  placeholder="e.g. 5012345678900"
                  className="px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-highlight"
                />
              </div>
            )}
          </div>
        )}

        <div className="grid gap-3">
          <h4 className="text-sm font-semibold text-zinc-300">Expiration date</h4>
          <CapturedPhoto image={pending.expirationImage} alt="Expiration photo" />
          <MdyDateInput
            idPrefix="process-expiration"
            value={expiration}
            onChange={setExpiration}
            inputClassName="px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-highlight"
          />
        </div>

        <div className="grid gap-3">
          <h4 className="text-sm font-semibold text-zinc-300">Measure</h4>
          <CapturedPhoto image={pending.measureImage} alt="Measure photo" />
          <MeasureAmountFields
            idPrefix="process"
            measure={effectiveMeasure}
            onMeasureChange={setMeasure}
            amount={amount}
            onAmountChange={setAmount}
          />
        </div>

        <div className="grid gap-3">
          <h4 className="text-sm font-semibold text-zinc-300">Name</h4>
          <label htmlFor="process-name" className="text-xs text-zinc-400">Name</label>
          <input
            id="process-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Item name"
            className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-highlight"
          />
          <CandidatePills
            candidates={candidates}
            value={name}
            onSelect={setName}
            label="From OpenFoodFacts — tap a name to use it"
          />

          <label htmlFor="process-brand" className="text-xs text-zinc-400">Brand (optional)</label>
          <input
            id="process-brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. Heinz"
            className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-highlight"
          />
          <CandidatePills
            candidates={brandCandidates}
            value={brand}
            onSelect={setBrand}
            label="From OpenFoodFacts — tap a brand to use it"
          />

          {/* Item photo — from OpenFoodFacts if found, or taken manually. */}
          <div className="flex items-center gap-4">
            <InventoryImage
              item={{ image: image ?? undefined, name: '' }}
              className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
            />
            <PhotoCaptureInput
              label={image ? 'Take your own photo' : 'Take a photo (optional)'}
              onCaptured={setImage}
            />
          </div>
        </div>

        {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleComplete}
            disabled={submitting || missingFields}
            className="px-6 py-2 bg-highlight text-white font-semibold rounded-lg disabled:opacity-40"
          >
            {submitting ? 'Adding…' : 'Add to inventory'}
          </button>
          <button
            type="button"
            onClick={handleDiscard}
            disabled={submitting}
            className="rounded-lg border-2 border-red-500 px-4 py-1.5 text-sm text-red-400 hover:bg-red-600 hover:text-white disabled:opacity-50"
          >
            Discard
          </button>
        </div>
      </section>
    </>
  );
}
