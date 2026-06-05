import { useEffect, useRef, useState } from 'react';
import MeasureCombobox from './MeasureCombobox';

type Props = {
  suggestedName: string;
  matches: Ingredient[];
  onSelect: (ingredient: Ingredient) => void;
  onClose: () => void;
};

export default function IngredientModal({ suggestedName, matches, onSelect, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState(suggestedName);
  const [measure, setMeasure] = useState<Measure | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Open as a modal (adds ::backdrop, traps focus, handles Escape)
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // Sync dialog close (Escape key) back to parent state
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.addEventListener('close', onClose);
    return () => dialog?.removeEventListener('close', onClose);
  }, [onClose]);

  // Click on the backdrop (dialog element itself, not its children) closes the modal
  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) onClose();
  }

  async function createIngredient() {
    if (!name.trim() || !measure) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), measureId: measure.measureId }),
      });
      if (!res.ok) { setError('Failed to create ingredient'); return; }
      const created: Ingredient = await res.json();
      onSelect(created);
    } catch {
      setError('Unexpected error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="w-full max-w-md rounded-2xl p-6 bg-zinc-900 text-white shadow-2xl backdrop:bg-black/65 open:flex open:flex-col open:gap-3 overflow-y-auto max-h-[80svh]"
    >
      <h2 className="text-lg font-semibold">Select ingredient</h2>

      {suggestedName && (
        <p className="text-zinc-400 text-sm">
          Found: <strong className="text-white">{suggestedName}</strong>
        </p>
      )}

      {matches.length > 0 && (
        <ul className="flex flex-col gap-2">
          {matches.map((ing) => (
            <li key={ing.uuid}>
              <button
                type="button"
                onClick={() => onSelect(ing)}
                className="w-full flex justify-between items-center px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg hover:border-sky-400 text-left"
              >
                <span className="font-medium">{ing.name}</span>
                <span className="text-zinc-400 text-sm">{ing.measure.plural}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {matches.length === 0 && !showCreate && (
        <p className="text-zinc-500 text-sm">No matching ingredients found.</p>
      )}

      {!showCreate ? (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="w-full py-2.5 border border-dashed border-sky-500 text-sky-400 rounded-lg text-sm hover:border-sky-400 hover:text-sky-300"
        >
          + Create ingredient
        </button>
      ) : (
        <div className="flex flex-col gap-3 pt-1">
          <h3 className="font-medium">New ingredient</h3>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-400">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ingredient name"
              className="px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-md text-white text-sm focus:outline-none focus:border-sky-400"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-400">Measure</label>
            <MeasureCombobox value={measure} onChange={setMeasure} />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={createIngredient}
              disabled={saving || !name.trim() || !measure}
              className="flex-1 py-2 bg-sky-500 text-black font-semibold text-sm rounded-lg disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save ingredient'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="flex-1 py-2 bg-zinc-700 text-white text-sm rounded-lg hover:bg-zinc-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        className="text-zinc-500 text-sm hover:text-zinc-300 mt-1 self-center"
      >
        ✕ Cancel scan
      </button>
    </dialog>
  );
}
