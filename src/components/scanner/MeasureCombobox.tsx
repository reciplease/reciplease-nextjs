import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';

const fetcher = (url: string): Promise<Measure[]> => fetch(url).then((r) => r.json());

type Props = {
  value: Measure | null;
  onChange: (measure: Measure) => void;
};

// Picker over the static measure catalog (served from a backend enum). Measures
// are fixed reference data, so there's no "create" path — just search and select.
export default function MeasureCombobox({ value, onChange }: Props) {
  const { data: measures = [] } = useSWR<Measure[]>('/api/measures', fetcher);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const filtered = measures.filter((m) =>
    `${m.singular} ${m.plural} ${m.short}`.toLowerCase().includes(query.toLowerCase()),
  );

  function selectMeasure(m: Measure) {
    onChange(m);
    setQuery('');
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
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
                  {m.singular} / {m.plural}{' '}
                  <span className="text-zinc-500">({m.short})</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-zinc-500">No measures found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
