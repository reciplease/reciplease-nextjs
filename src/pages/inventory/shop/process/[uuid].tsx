import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import useSWR from 'swr';
import Metadata from '@/components/Metadata';
import MdyDateInput from '@/components/MdyDateInput';
import MeasureAmountFields from '@/components/scanner/MeasureAmountFields';
import NameCandidates from '@/components/scanner/NameCandidates';
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
  const [candidates, setCandidates] = useState<string[]>([]);
  const [suggestedMeasureId, setSuggestedMeasureId] = useState<string | null>(null);
  const [measure, setMeasure] = useState<Measure | null>(null);
  const [amount, setAmount] = useState('');
  const [expiration, setExpiration] = useState(toIsoDate(new Date()));
  // Raw base64 JPEG for the item itself — from an OpenFoodFacts product photo
  // or a manually taken one. Best-effort, like the single-item scan flow.
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const barcode = pending.barcode;

  // Suggest a name/measure from the barcode (prior inventory, then
  // OpenFoodFacts) — the capture loop deferred all lookups to here.
  useEffect(() => {
    if (!barcode) return;
    let cancelled = false;
    suggestItemFromBarcode(barcode).then((suggestion) => {
      if (cancelled) return;
      setName((prior) => prior || suggestion.name);
      setCandidates(suggestion.candidates);
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
      router.push('/inventory/shop/process');
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
          on the same background they were reviewed against during capture. */}
      <section className="grid gap-8 rounded-xl bg-zinc-900 text-white p-6 max-w-lg">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-semibold mr-auto">Process item</h3>
          {barcode && <p className="font-mono text-xs text-zinc-400">{barcode}</p>}
        </div>

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
          <NameCandidates candidates={candidates} value={name} onSelect={setName} />

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
          <Link
            href="/inventory/shop/process"
            className="self-center text-sm text-zinc-400 hover:text-white"
          >
            ← Back to the list
          </Link>
        </div>
      </section>
    </>
  );
}
