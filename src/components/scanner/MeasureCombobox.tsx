import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';

const fetcher = (url: string): Promise<Measure[]> => fetch(url).then((r) => r.json());

type Props = {
  value: Measure | null;
  onChange: (measure: Measure) => void;
};

type CreateState = { singular: string; plural: string };

export default function MeasureCombobox({ value, onChange }: Props) {
  const { data: measures = [], mutate } = useSWR<Measure[]>('/api/measures', fetcher);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateState>({ singular: '', plural: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const filtered = measures.filter((m) =>
    `${m.singular} ${m.plural}`.toLowerCase().includes(query.toLowerCase()),
  );

  function selectMeasure(m: Measure) {
    onChange(m);
    setQuery('');
    setOpen(false);
    setCreating(false);
  }

  async function saveNewMeasure() {
    if (!createForm.singular.trim() || !createForm.plural.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/measures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      if (!res.ok) { setError('Failed to create measure'); return; }
      const created: Measure = await res.json();
      await mutate();
      selectMeasure(created);
      setCreateForm({ singular: '', plural: '' });
    } catch {
      setError('Unexpected error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setCreating(false); }}
        className="w-full flex justify-between items-center px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-md text-white text-sm hover:border-sky-400 focus:outline-none focus:border-sky-400"
      >
        <span>{value ? `${value.singular} / ${value.plural}` : 'Select measure…'}</span>
        <span className="text-zinc-400 text-xs">▾</span>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-zinc-900 border border-zinc-600 rounded-lg z-50 max-h-64 overflow-y-auto shadow-xl">
          <input
            autoFocus
            placeholder="Search measures…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-950 border-b border-zinc-700 text-white text-sm focus:outline-none"
          />

          <ul className="py-1">
            {filtered.map((m) => (
              <li key={m.measureId}>
                <button
                  type="button"
                  onClick={() => selectMeasure(m)}
                  className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white"
                >
                  {m.singular} / {m.plural}
                </button>
              </li>
            ))}
          </ul>

          <div className="border-t border-zinc-700 p-2">
            {!creating ? (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full text-left px-1 py-1 text-sm text-sky-400 hover:text-sky-300"
              >
                + Create new measure
              </button>
            ) : (
              <div className="flex flex-col gap-2 pt-1">
                <input
                  placeholder="Singular (e.g. gram)"
                  value={createForm.singular}
                  onChange={(e) => setCreateForm((f) => ({ ...f, singular: e.target.value }))}
                  className="px-2 py-1.5 bg-zinc-950 border border-zinc-600 rounded text-white text-sm focus:outline-none focus:border-sky-400"
                />
                <input
                  placeholder="Plural (e.g. grams)"
                  value={createForm.plural}
                  onChange={(e) => setCreateForm((f) => ({ ...f, plural: e.target.value }))}
                  className="px-2 py-1.5 bg-zinc-950 border border-zinc-600 rounded text-white text-sm focus:outline-none focus:border-sky-400"
                />
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveNewMeasure}
                    disabled={saving}
                    className="flex-1 py-1.5 bg-sky-500 text-black text-sm font-semibold rounded disabled:opacity-40"
                  >
                    {saving ? 'Saving…' : 'Save measure'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="flex-1 py-1.5 bg-zinc-700 text-white text-sm rounded hover:bg-zinc-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
