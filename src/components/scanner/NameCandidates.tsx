type Props = {
  candidates: string[];
  value: string;
  onSelect: (name: string) => void;
};

// OpenFoodFacts name candidates — tap one to use it as the item name.
export default function NameCandidates({ candidates, value, onSelect }: Props) {
  if (candidates.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-zinc-950/60 border border-zinc-800 p-4">
      <p className="text-xs font-semibold text-zinc-400">
        From OpenFoodFacts — tap a name to use it
      </p>
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
