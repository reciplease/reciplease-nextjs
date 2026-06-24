import { useCallback, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import Metadata from '@/components/Metadata';
import MeasureCombobox from '@/components/scanner/MeasureCombobox';
import { lookupProduct } from '@/lib/openfoodfacts';
import { compressToBase64, toDataUrl } from '@/lib/imageCapture';
import { formatDate } from '@/lib/formatDate';
import { apiFetch } from '@/lib/houses';
import { useMeasures } from '@/lib/measures';

// Load scanner adapters client-side only (they use browser APIs)
const BarcodeScanner = dynamic(() => import('@/components/scanner/BarcodeScanner'), { ssr: false });

type ScanPhase = 'barcode' | 'details' | 'expiration' | 'amount';

const PHASE_LABEL: Record<ScanPhase, string> = {
  barcode: 'Scan barcode',
  details: 'Confirm item',
  expiration: 'Enter expiration date',
  amount: 'Enter amount',
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
  // inventory item itself so future scans can suggest it when planning recipes.
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [measure, setMeasure] = useState<Measure | null>(null);
  const [expiration, setExpiration] = useState('');
  const [amount, setAmount] = useState('');
  // Where the suggested name came from, so we can hint at it on the confirm step.
  const [nameSource, setNameSource] = useState<'inventory' | 'openfoodfacts' | null>(null);
  // Name candidates from OpenFoodFacts, so the user can pick one.
  const [candidates, setCandidates] = useState<string[]>([]);
  // Raw base64 JPEG (no `data:` prefix) — from an OpenFoodFacts photo or a
  // manually taken one. Best-effort: absent if neither is available.
  const [image, setImage] = useState<string | null>(null);
  // Manual barcode entry (when there's no camera, or you only have the number).
  const [manualBarcode, setManualBarcode] = useState('');
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successFlash, setSuccessFlash] = useState(false);

  // Called by BarcodeScanner when a barcode is read: suggest a name and move to
  // the confirm step. We first check whether this barcode has been added to the
  // inventory before (including expired items, which still carry the barcode) and
  // reuse that name/measure; otherwise we fall back to OpenFoodFacts.
  const handleBarcodeDetected = useCallback(async (scanned: string) => {
    setLooking(true);
    setBarcode(scanned);

    let suggestedName = '';
    let suggestedMeasure: Measure | null = null;
    let source: 'inventory' | 'openfoodfacts' | null = null;

    try {
      const res = await apiFetch('/api/inventory');
      if (res.ok) {
        const items: InventoryItem[] = await res.json();
        const prior = items.find((it) => it.barcode === scanned);
        if (prior) {
          suggestedName = prior.name;
          suggestedMeasure = measures.find((m) => m.measureId === prior.measure) ?? null;
          source = 'inventory';
        }
      }
    } catch {
      // Ignore and fall back to OpenFoodFacts below.
    }

    if (!suggestedName) {
      const { nameCandidates, measureId, imageUrl } = await lookupProduct(scanned);
      setCandidates(nameCandidates);
      if (nameCandidates.length > 0) {
        suggestedName = nameCandidates[0];
        source = 'openfoodfacts';
      }
      // Suggest a measure parsed from the product quantity, if we stock it.
      if (measureId) {
        suggestedMeasure =
          measures.find((m) => m.measureId === measureId) ?? suggestedMeasure;
      }
      // Fetch and compress the product photo in the background — best-effort,
      // so a slow/failed/CORS-blocked fetch never blocks the scan flow.
      if (imageUrl) {
        fetchAsImage(imageUrl)
          .then((blob) => compressToBase64(blob))
          .then(setImage)
          .catch(() => {});
      }
    }

    setName(suggestedName);
    setMeasure(suggestedMeasure);
    setNameSource(source);
    setLooking(false);
    setPhase('details');
  }, [measures]);

  function handleConfirmDetails() {
    if (!name.trim() || !measure) return;
    setExpiration('');
    setPhase('expiration');
  }

  function resetForNextScan() {
    setBarcode('');
    setName('');
    setMeasure(null);
    setExpiration('');
    setAmount('');
    setNameSource(null);
    setCandidates([]);
    setImage(null);
    setManualBarcode('');
    setPhase('barcode');
  }

  async function handlePhotoSelected(file: File) {
    try {
      setImage(await compressToBase64(file));
    } catch {
      // Ignore — the user can just try again or leave the item without a photo.
    }
  }

  function handleUseExpirationDate() {
    if (!expiration) return;
    setPhase('amount');
  }

  // Submit a typed barcode through the same flow as a camera scan.
  function handleManualBarcode() {
    const trimmed = manualBarcode.trim();
    if (!trimmed || looking) return;
    handleBarcodeDetected(trimmed);
  }

  async function handleSave() {
    if (!name.trim() || !measure || !expiration || !amount) return;
    setSaving(true);
    setSaveError(null);
    try {
      const body: CreateInventoryItem = {
        name: name.trim(),
        measureId: measure.measureId,
        amount: parseFloat(amount),
        expiration,
        ...(barcode ? { barcode } : {}),
        ...(image ? { image } : {}),
      };
      const res = await apiFetch('/api/inventory', {
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
      <Metadata title="Scan item" description="Scan a food barcode to add to inventory" />

      {/* Standalone full-screen page — no Layout header above us, so apply the
          inventory accent here (the Layout wrapper that normally does it is skipped). */}
      <div className="inventory-theme flex flex-col bg-black text-white h-svh"
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
          {(phase === 'details' || phase === 'expiration' || phase === 'amount') && (
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
              <h2 className="text-lg font-semibold">New inventory item</h2>
              <p className="text-xs text-zinc-400">
                {nameSource === 'inventory'
                  ? 'Suggested from a previous inventory item with this barcode.'
                  : nameSource === 'openfoodfacts'
                    ? 'Suggested from the product barcode. Edit anything that looks off.'
                    : 'Give this item a name and a measure.'}
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
            </div>

            {/* OpenFoodFacts name candidates — tap one to use it as the name. */}
            {candidates.length > 0 && (
              <div className="flex flex-col gap-3 rounded-lg bg-zinc-950/60 border border-zinc-800 p-4">
                <p className="text-xs font-semibold text-zinc-400">
                  From OpenFoodFacts — tap a name to use it
                </p>
                <div className="flex flex-wrap gap-2">
                  {candidates.map((candidate) => {
                    const selected = candidate === name.trim();
                    return (
                      <button
                        key={candidate}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setName(candidate)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition ${
                          selected
                            ? 'border-highlight bg-highlight/20 text-white'
                            : 'border-zinc-600 bg-zinc-800 text-zinc-200 hover:border-zinc-400'
                        }`}
                      >
                        {candidate}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Photo preview — from OpenFoodFacts if found, or taken manually. */}
            <div className="flex items-center gap-4">
              {image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={toDataUrl(image)}
                  alt=""
                  className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
                />
              )}
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-400">
                  {image ? 'Take your own photo' : 'Take a photo (optional)'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoSelected(file);
                    e.target.value = '';
                  }}
                  className="text-sm text-zinc-300"
                />
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs text-zinc-400">Measure</label>
              <MeasureCombobox value={measure} onChange={setMeasure} />
            </div>
            {barcode && <p className="text-xs text-zinc-500">Barcode: {barcode}</p>}
            <div className="flex gap-3 flex-wrap pt-1">
              <button
                type="button"
                onClick={handleConfirmDetails}
                disabled={!name.trim() || !measure}
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

        {/* Amount panel */}
        {phase === 'amount' && (
          <div className="bg-zinc-900 px-6 py-5 flex flex-col gap-3">
            <p className="text-sm">
              <strong>{name}</strong>
              <span className="text-zinc-400"> · {formatDate(expiration)}</span>
            </p>
            <label htmlFor="scan-amount" className="text-xs text-zinc-400">
              Amount ({measure?.plural})
            </label>
            <input
              id="scan-amount"
              type="number"
              min="0"
              step="any"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Amount in ${measure?.plural ?? 'units'}`}
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-600 rounded-lg text-white text-lg focus:outline-none focus:border-highlight"
            />
            {saveError && <p className="text-red-400 text-xs">{saveError}</p>}
            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !amount}
                className="px-6 py-2 bg-highlight text-white font-semibold rounded-lg disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => { setPhase('expiration'); setExpiration(''); }}
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
            <label htmlFor="scan-expiration" className="text-xs text-zinc-400">
              Expiration date
            </label>
            <input
              id="scan-expiration"
              type="date"
              value={expiration}
              onChange={(e) => setExpiration(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-highlight"
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
