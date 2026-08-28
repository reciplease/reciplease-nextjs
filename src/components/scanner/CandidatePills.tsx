type Props = {
  candidates: string[];
  value: string;
  onSelect: (value: string) => void;
  label: string;
};

// Tap-a-pill picker for candidate values (name or brand) sourced from
// OpenFoodFacts or a prior pantry match.
export default function CandidatePills({ candidates, value, onSelect, label }: Props) {
  if (candidates.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-zinc-950/60 border border-zinc-800 p-4">
      <p className="text-xs font-semibold text-zinc-400">{label}</p>
      <div className="flex flex-wrap gap-2">
        {candidates.map((candidate) => {
          const selected = candidate === value.trim();
          return (
            <button
              key={candidate}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(candidate)}
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
  );
}
