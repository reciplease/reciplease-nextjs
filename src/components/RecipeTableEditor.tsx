import { useMemo, useState, type KeyboardEvent } from 'react';
import TableGrid from '@/components/TableGrid';
import { addRow, combine, layoutTable, remove, rename } from '@/lib/recipe-table';

type Props = {
  cells: TableCell[];
  ingredients: string[];
  onChange: (cells: TableCell[]) => void;
};

const isRoot = (path: string) => !path.includes('.');

export default function RecipeTableEditor({ cells, ingredients, onChange }: Props) {
  const layout = useMemo(() => layoutTable(cells), [cells]);
  const textByPath = useMemo(
    () => new Map(layout.rows.flat().map((cell) => [cell.path, cell.text])),
    [layout],
  );
  const leafPaths = useMemo(
    () => new Set(layout.rows.flat().filter((cell) => cell.leaf).map((cell) => cell.path)),
    [layout],
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [newRow, setNewRow] = useState('');

  const missingIngredients = ingredients.filter(
    (ingredient) => !Array.from(leafPaths).some((path) => textByPath.get(path) === ingredient),
  );
  const only = selected.length === 1 ? selected[0] : null;
  const canAddStep = selected.length > 0 && selected.every(isRoot) && text.trim() !== '';
  const canRename = only !== null && text.trim() !== '';
  const canRemove = only !== null && (isRoot(only) || !leafPaths.has(only));

  function apply(next: TableCell[]) {
    onChange(next);
    setSelected([]);
    setText('');
  }

  function toggle(path: string) {
    const next = selected.includes(path) ? selected.filter((p) => p !== path) : [...selected, path];
    setSelected(next);
    setText(next.length === 1 ? (textByPath.get(next[0]) ?? '') : '');
  }

  function submitRow() {
    if (!newRow.trim()) return;
    apply(addRow(cells, newRow.trim()));
    setNewRow('');
  }

  function onRowKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    submitRow();
  }

  function onStepKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (canAddStep) apply(combine(cells, selected.map(Number), text.trim()));
    else if (canRename) apply(rename(cells, only, text.trim()));
  }

  return (
    <div className="grid gap-3">
      {cells.length > 0 && (
        <TableGrid
          layout={layout}
          label="Method editor"
          pressed={new Set(selected)}
          pressedClassName="bg-highlight/20 outline-2 -outline-offset-2 outline-highlight"
          onCellClick={toggle}
        />
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            aria-label="Step text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onStepKeyDown}
            placeholder={selected.length > 1 ? 'What happens to these? e.g. mix' : 'Step, e.g. melt'}
            className="field min-w-0 flex-1"
          />
          <button
            type="button"
            disabled={!canAddStep}
            onClick={() => apply(combine(cells, selected.map(Number), text.trim()))}
          >
            Add step
          </button>
          <button type="button" disabled={!canRename} onClick={() => only && apply(rename(cells, only, text.trim()))}>
            Rename
          </button>
          <button type="button" disabled={!canRemove} onClick={() => only && apply(remove(cells, only))}>
            Remove
          </button>
          <button type="button" onClick={() => apply(cells)}>
            Clear selection
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          aria-label="New row"
          value={newRow}
          onChange={(e) => setNewRow(e.target.value)}
          onKeyDown={onRowKeyDown}
          placeholder="Add an ingredient or equipment row, e.g. oven"
          className="field min-w-0 flex-1"
        />
        <button type="button" disabled={!newRow.trim()} onClick={submitRow}>
          Add row
        </button>
        {missingIngredients.length > 0 && (
          <button
            type="button"
            onClick={() => apply(missingIngredients.reduce(addRow, cells))}
          >
            Add ingredients as rows
          </button>
        )}
      </div>
    </div>
  );
}
