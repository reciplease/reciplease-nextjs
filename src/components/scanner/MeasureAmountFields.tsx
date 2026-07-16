import MeasureCombobox from '@/components/scanner/MeasureCombobox';

type Props = {
  idPrefix: string;
  measure: Measure | null;
  onMeasureChange: (measure: Measure) => void;
  amount: string;
  onAmountChange: (amount: string) => void;
};

// Measure and amount entered together as one step — they describe the same fact
// ("500 millilitres"), so splitting them across the flow just made users answer
// half a question twice.
export default function MeasureAmountFields({
  idPrefix,
  measure,
  onMeasureChange,
  amount,
  onAmountChange,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-xs text-zinc-400">Measure</label>
        <MeasureCombobox value={measure} onChange={onMeasureChange} />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-amount`} className="text-xs text-zinc-400">
          Amount {measure ? `(${measure.plural})` : ''}
        </label>
        <input
          id={`${idPrefix}-amount`}
          type="number"
          min="0"
          step="any"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder={`Amount in ${measure?.plural ?? 'units'}`}
          className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-600 rounded-lg text-white text-lg focus:outline-none focus:border-highlight"
        />
      </div>
    </div>
  );
}
