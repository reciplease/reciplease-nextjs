import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import Metadata from '@/components/Metadata';
import MdyDateInput from '@/components/MdyDateInput';
import MeasureAmountFields from '@/components/scanner/MeasureAmountFields';
import CandidatePills from '@/components/scanner/CandidatePills';
import PhotoCaptureInput from '@/components/scanner/PhotoCaptureInput';
import PantryImage from '@/components/PantryImage';
import { suggestItemFromBarcode } from '@/lib/suggestItemFromBarcode';
import { compressToBase64 } from '@/lib/imageCapture';
import { formatDate } from '@/lib/formatDate';
import { apiFetch } from '@/lib/houses';
import { useMeasures } from '@/lib/measures';
import { toIsoDate } from '@/lib/week';
import { CreatePantryItemBody, createPantryItemBodyBarcodeRegExp } from '@/types/generated/zod';

// This form never collects `remaining` — the backend defaults a missing
// `remaining` to `amount` on create — so it's dropped from the generated
// body schema. The generated `amount` constraint is `>= 0`; this form
// additionally rejects zero, since a zero-amount pantry item isn't
// meaningful.
const CreatePantryItemFormSchema = CreatePantryItemBody.omit({ remaining: true }).extend({
  amount: CreatePantryItemBody.shape.amount.gt(0, 'Amount must be greater than 0.'),
});

// Load scanner adapters client-side only (they use browser APIs)
const BarcodeScanner = dynamic(() => import('@/components/scanner/BarcodeScanner'), { ssr: false });

type ScanPhase = 'barcode' | 'details' | 'expiration' | 'measureAmount';

const PHASE_LABEL: Record<ScanPhase, string> = {
  barcode: 'Scan barcode',
  details: 'Confirm item',
  expiration: 'Enter expiration date',
  measureAmount: 'Enter measure and amount',
};

async function fetchAsImage(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch image');
  return res.blob();
}

export default function ScanPage() {
  const router = useRouter();
  // Shared cache with MeasureCombobox; used to resolve a suggested measureId.
  const measures = useMeasures();

  const [phase, setPhase] = useState<ScanPhase>('barcode');
  // The item being built up across phases. The barcode is recorded on the
  // pantry item itself so future scans can suggest it when planning recipes.
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [measure, setMeasure] = useState<Measure | null>(null);
  const [expiration, setExpiration] = useState(toIsoDate(new Date()));
  const [amount, setAmount] = useState('');
  // Where the suggested name came from, so we can hint at it on the confirm step.
  const [nameSource, setNameSource] = useState<'pantry' | 'openfoodfacts' | null>(null);
  // Name/brand candidates from OpenFoodFacts, so the user can pick one.
  const [candidates, setCandidates] = useState<string[]>([]);
  const [brandCandidates, setBrandCandidates] = useState<string[]>([]);
  // Raw base64 JPEG (no `data:` prefix) — from an OpenFoodFacts photo or a
  // manually taken one. Best-effort: absent if neither is available.
  const [image, setImage] = useState<string | null>(null);
  // Manual barcode entry (when there's no camera, or you only have the number).
  const [manualBarcode, setManualBarcode] = useState('');
  const [looking, setLooking] = useState(false);
  const [manualBarcodeError, setManualBarcodeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successFlash, setSuccessFlash] = useState(false);
  // Bumped on every new scan/reset so a slow product-photo fetch from a previous
  // scan can't attach its image to the item currently being entered.
  const scanSeqRef = useRef(0);

  // Called by BarcodeScanner when a barcode is read: suggest a name and move to
  // the confirm step. We first check whether this barcode has been added to the
  // pantry before (including expired items, which still carry the barcode) and
  // reuse that name/measure; otherwise we fall back to OpenFoodFacts.
  const handleBarcodeDetected = useCallback(async (scanned: string) => {
    const seq = ++scanSeqRef.current;
    setLooking(true);
    setBarcode(scanned);

    const suggestion = await suggestItemFromBarcode(scanned);

    setCandidates(suggestion.candidates);
    setBrandCandidates(suggestion.brandCandidates);
    // Fetch and compress the product photo in the background — best-effort,
    // so a slow/failed/CORS-blocked fetch never blocks the scan flow.
    if (suggestion.imageUrl) {
      fetchAsImage(suggestion.imageUrl)
        .then((blob) => compressToBase64(blob))
        .then((base64) => {
          if (scanSeqRef.current === seq) setImage(base64);
        })
        .catch(() => {});
    }

    setName(suggestion.name);
    setBrand(suggestion.brand);
    // The suggested measure pre-fills the measure+amount step later in the flow.
    setMeasure(measures.find((m) => m.measureId === suggestion.measureId) ?? null);
    setNameSource(suggestion.source);
    setLooking(false);
    setPhase('details');
  }, [measures]);

  function handleConfirmDetails() {
    if (!name.trim()) return;
    setExpiration(toIsoDate(new Date()));
    setPhase('expiration');
  }

  function resetForNextScan() {
    scanSeqRef.current++;
    setBarcode('');
    setName('');
    setBrand('');
    setMeasure(null);
    setExpiration(toIsoDate(new Date()));
    setAmount('');
    setNameSource(null);
    setCandidates([]);
    setBrandCandidates([]);
    setImage(null);
    setManualBarcode('');
    setPhase('barcode');
  }

  function handleUseExpirationDate() {
    if (!expiration) return;
    setPhase('measureAmount');
  }

  // Submit a typed barcode through the same flow as a camera scan.
  function handleManualBarcode() {
    const trimmed = manualBarcode.trim();
    if (!trimmed || looking) return;
    if (!createPantryItemBodyBarcodeRegExp.test(trimmed)) {
      setManualBarcodeError('Enter a valid barcode (8 or 12–14 digits).');
      return;
    }
    setManualBarcodeError(null);
    handleBarcodeDetected(trimmed);
  }

  async function handleSave() {
    if (!name.trim() || !measure?.measureId || !expiration || !amount) return;
    const candidate = {
      name: name.trim(),
      measure: measure.measureId,
      amount: parseFloat(amount),
      expiration,
      ...(brand.trim() ? { brand: brand.trim() } : {}),
      ...(barcode ? { barcode } : {}),
      ...(image ? { image } : {}),
    };
    const validation = CreatePantryItemFormSchema.safeParse(candidate);
    if (!validation.success) {
      setSaveError(validation.error.issues[0]?.message ?? 'Please check the form and try again.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const body: CreatePantryItem = candidate;
      const res = await apiFetch('/api/pantry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setSaveError('Failed to save. Please try again.');
        return;
      }
      // Flash success then reset for next scan
      setSuccessFlash(true);
      setTimeout(() => setSuccessFlash(false), 2000);
      resetForNextScan();
    } catch {
      setSaveError('Unexpected error.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Metadata title="Scan item" description="Scan a food barcode to add to pantry" />

      {/* Standalone full-screen page — no Layout header above us, so apply the
          pantry accent here (the Layout wrapper that normally does it is skipped). */}
      <div className="pantry-theme flex flex-col bg-black text-white h-svh"
           style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

        {/* Camera view — fills remaining space */}
        <div className="relative flex-1 overflow-hidden bg-zinc-950 min-h-64">

          {/* Phase pill — the key on the inner span re-triggers the entrance
              animation each time the phase changes, instead of swapping the
              label instantly. */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/55 rounded-full px-5 py-1.5 pointer-events-none z-10 overflow-hidden">
            <span key={phase} className="fade-rise-in block text-sm font-semibold whitespace-nowrap">
              {PHASE_LABEL[phase]}
            </span>
          </div>

          {phase === 'barcode' && (
            <BarcodeScanner active={!looking} onDetected={handleBarcodeDetected} />
          )}
          {(phase === 'details' || phase === 'expiration' || phase === 'measureAmount') && (
            // Camera off during data entry — show a dark placeholder. Expiration
            // date is typed in below; scanning it never worked reliably enough
            // (small print, varied date formats, glare) to be worth keeping.
            <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-600 text-sm">
              Camera paused
            </div>
          )}

          {successFlash && (
            <div className="absolute inset-0 flex items-center justify-center bg-green-600/70 text-white text-4xl font-bold pointer-events-none z-20">
              ✓ Saved!
            </div>
          )}
        </div>

        {/* Manual barcode entry — for desktop testing, or when you have the
            number but no scannable barcode. Runs the same lookup flow. */}
        {phase === 'barcode' && (
          <div className="bg-zinc-900 px-6 py-4 flex flex-col gap-2">
            <label htmlFor="manual-barcode" className="text-xs text-zinc-400">
              Or enter a barcode manually
            </label>
            <div className="flex gap-3 flex-wrap">
              <input
                id="manual-barcode"
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
                disabled={!manualBarcode.trim() || looking}
                className="px-5 py-2 bg-highlight text-white font-semibold rounded-lg disabled:opacity-40"
              >
                {looking ? 'Looking…' : 'Look up'}
              </button>
            </div>
          </div>
        )}

        {/* Confirm details panel */}
        {phase === 'details' && (
          <div className="bg-zinc-900 px-6 py-8 flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">New pantry item</h2>
              <p className="text-xs text-zinc-400">
                {nameSource === 'pantry'
                  ? 'Suggested from a previous pantry item with this barcode.'
                  : nameSource === 'openfoodfacts'
                    ? 'Suggested from the product barcode. Edit anything that looks off.'
                    : 'Give this item a name.'}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="scan-name" className="text-xs text-zinc-400">Name</label>
              <input
                id="scan-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Item name"
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-highlight"
              />
              <p className="text-xs text-zinc-500">
                Lowercase, phrased how a recipe would say it — e.g. &quot;cherry tomatoes&quot;, not
                &quot;Cherry Tomatoes&quot; or &quot;Sainsbury&apos;s cherry tomatoes&quot; (brand goes below).
              </p>
            </div>

            {/* OpenFoodFacts name candidates — tap one to use it as the name. */}
            <CandidatePills
              candidates={candidates}
              value={name}
              onSelect={setName}
              label="From OpenFoodFacts — tap a name to use it"
            />

            <div className="flex flex-col gap-2">
              <label htmlFor="scan-brand" className="text-xs text-zinc-400">Brand (optional)</label>
              <input
                id="scan-brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Heinz"
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-highlight"
              />
            </div>

            <CandidatePills
              candidates={brandCandidates}
              value={brand}
              onSelect={setBrand}
              label="From OpenFoodFacts — tap a brand to use it"
            />

            {/* Photo preview — from OpenFoodFacts if found, or taken manually. */}
            <div className="flex items-center gap-4">
              <PantryImage
                item={{ image: image ?? undefined, name: '' }}
                className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
              />
              <PhotoCaptureInput
                label={image ? 'Take your own photo' : 'Take a photo (optional)'}
                onCaptured={setImage}
              />
            </div>

            {barcode && <p className="text-xs text-zinc-500">Barcode: {barcode}</p>}
            <div className="flex gap-3 flex-wrap pt-1">
              <button
                type="button"
                onClick={handleConfirmDetails}
                disabled={!name.trim()}
                className="px-6 py-2 bg-highlight text-white font-semibold rounded-lg disabled:opacity-40"
              >
                Continue →
              </button>
              <button
                type="button"
                onClick={resetForNextScan}
                className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 text-sm"
              >
                ← Rescan barcode
              </button>
            </div>
          </div>
        )}

        {/* Measure + amount panel — one step, since "500 ml" is a single fact. */}
        {phase === 'measureAmount' && (
          <div className="bg-zinc-900 px-6 py-5 flex flex-col gap-3">
            <p className="text-sm">
              <strong>{name}</strong>
              <span className="text-zinc-400"> · {formatDate(expiration)}</span>
            </p>
            <MeasureAmountFields
              idPrefix="scan"
              measure={measure}
              onMeasureChange={setMeasure}
              amount={amount}
              onAmountChange={setAmount}
            />
            {saveError && <p className="text-red-400 text-xs">{saveError}</p>}
            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !measure || !amount}
                className="px-6 py-2 bg-highlight text-white font-semibold rounded-lg disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => { setPhase('expiration'); setExpiration(toIsoDate(new Date())); }}
                className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 text-sm"
              >
                ← Edit date
              </button>
            </div>
          </div>
        )}

        {/* Expiration date entry */}
        {phase === 'expiration' && (
          <div className="bg-zinc-900 px-6 py-4 flex flex-col gap-2">
            <label htmlFor="scan-expiration-day" className="text-xs text-zinc-400">
              Expiration date
            </label>
            <MdyDateInput
              idPrefix="scan-expiration"
              value={expiration}
              onChange={setExpiration}
              inputClassName="px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-highlight"
            />
            {expiration && (
              <button
                type="button"
                onClick={handleUseExpirationDate}
                className="self-start px-5 py-2 bg-highlight text-white font-semibold rounded-lg text-sm"
              >
                Continue →
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="bg-zinc-950 px-6 py-3">
          <button
            type="button"
            onClick={() => router.push('/pantry')}
            className="text-zinc-500 text-sm hover:text-white"
          >
            ← Back to pantry
          </button>
        </div>
      </div>
    </>
  );
}
