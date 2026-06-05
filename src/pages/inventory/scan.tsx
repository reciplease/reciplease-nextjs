import { useCallback, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import Metadata from '@/components/Metadata';
import IngredientModal from '@/components/scanner/IngredientModal';
import { lookupBarcode } from '@/lib/openfoodfacts';

// Load scanner adapters client-side only (they use browser APIs)
const BarcodeScanner = dynamic(() => import('@/components/scanner/BarcodeScanner'), { ssr: false });
const ExpirationScanner = dynamic(() => import('@/components/scanner/ExpirationScanner'), { ssr: false });

type ScanPhase = 'barcode' | 'expiration' | 'amount';

const PHASE_LABEL: Record<ScanPhase, string> = {
  barcode: 'Scan barcode',
  expiration: 'Scan expiration date',
  amount: 'Enter amount',
};

export default function ScanPage() {
  const router = useRouter();

  const [phase, setPhase] = useState<ScanPhase>('barcode');
  const [ingredient, setIngredient] = useState<Ingredient | null>(null);
  const [expiration, setExpiration] = useState('');
  const [manualExpiration, setManualExpiration] = useState('');
  const [amount, setAmount] = useState('');
  const [modal, setModal] = useState<{ suggestedName: string; matches: Ingredient[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successFlash, setSuccessFlash] = useState(false);

  // Called by BarcodeScanner when a barcode is read
  const handleBarcodeDetected = useCallback(async (barcode: string) => {
    const product = await lookupBarcode(barcode);
    const suggestedName = product?.productName?.trim() || barcode;
    const res = await fetch(`/api/ingredients/search?q=${encodeURIComponent(suggestedName)}`);
    const matches: Ingredient[] = res.ok ? await res.json() : [];
    setModal({ suggestedName, matches });
  }, []);

  // Called by ExpirationScanner when a date is confirmed
  const handleExpirationDetected = useCallback((isoDate: string) => {
    setExpiration(isoDate);
    setManualExpiration(isoDate);
    setPhase('amount');
  }, []);

  function handleIngredientSelect(selected: Ingredient) {
    setModal(null);
    setIngredient(selected);
    setExpiration('');
    setManualExpiration('');
    setPhase('expiration');
  }

  function handleModalClose() {
    setModal(null);
    setPhase('barcode');
  }

  function handleUseManualDate() {
    if (!manualExpiration) return;
    setExpiration(manualExpiration);
    setPhase('amount');
  }

  async function handleSave() {
    if (!ingredient || !expiration || !amount) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredientUuid: ingredient.uuid,
          amount: parseFloat(amount),
          expiration,
        }),
      });
      if (!res.ok) {
        setSaveError('Failed to save. Please try again.');
        return;
      }
      // Flash success then reset for next scan
      setSuccessFlash(true);
      setTimeout(() => setSuccessFlash(false), 2000);
      setIngredient(null);
      setExpiration('');
      setManualExpiration('');
      setAmount('');
      setPhase('barcode');
    } catch {
      setSaveError('Unexpected error.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Metadata title="Scan item" description="Scan a food barcode to add to inventory" />

      {/* Standalone full-screen page — no Layout header above us */}
      <div className="flex flex-col bg-black text-white h-svh"
           style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

        {/* Camera view — fills remaining space */}
        <div className="relative flex-1 overflow-hidden bg-zinc-950 min-h-64">

          {/* Phase pill */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/55 rounded-full px-5 py-1.5 pointer-events-none z-10">
            <span className="text-sm font-semibold whitespace-nowrap">{PHASE_LABEL[phase]}</span>
          </div>

          {phase === 'barcode' && (
            <BarcodeScanner active={!modal} onDetected={handleBarcodeDetected} />
          )}
          {phase === 'expiration' && (
            <ExpirationScanner active onDetected={handleExpirationDetected} />
          )}
          {phase === 'amount' && (
            // Camera off during amount entry — show a dark placeholder
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

        {/* Amount panel */}
        {phase === 'amount' && ingredient && (
          <div className="bg-zinc-900 px-6 py-5 flex flex-col gap-3">
            <p className="text-sm">
              <strong>{ingredient.name}</strong>
              <span className="text-zinc-400"> · {expiration}</span>
            </p>
            <label htmlFor="scan-amount" className="text-xs text-zinc-400">
              Amount ({ingredient.measure.plural})
            </label>
            <input
              id="scan-amount"
              type="number"
              min="0"
              step="any"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Amount in ${ingredient.measure.plural}`}
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-600 rounded-lg text-white text-lg focus:outline-none focus:border-sky-400"
            />
            {saveError && <p className="text-red-400 text-xs">{saveError}</p>}
            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !amount}
                className="px-6 py-2 bg-sky-500 text-black font-semibold rounded-lg disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => { setPhase('expiration'); setExpiration(''); }}
                className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 text-sm"
              >
                ← Rescan date
              </button>
            </div>
          </div>
        )}

        {/* Manual expiration override */}
        {phase === 'expiration' && (
          <div className="bg-zinc-900 px-6 py-4 flex flex-col gap-2">
            <p className="text-xs text-zinc-400">Or enter date manually:</p>
            <input
              type="date"
              value={manualExpiration}
              onChange={(e) => setManualExpiration(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-sky-400"
            />
            {manualExpiration && (
              <button
                type="button"
                onClick={handleUseManualDate}
                className="self-start px-5 py-2 bg-sky-500 text-black font-semibold rounded-lg text-sm"
              >
                Use this date →
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

      {modal && (
        <IngredientModal
          suggestedName={modal.suggestedName}
          matches={modal.matches}
          onSelect={handleIngredientSelect}
          onClose={handleModalClose}
        />
      )}
    </>
  );
}
