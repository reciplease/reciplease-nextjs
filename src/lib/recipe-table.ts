export type GridCell = {
  path: string;
  text: string;
  col: number;
  colSpan: number;
  rowSpan: number;
  leaf: boolean;
};

export type TableLayout = { columns: number; rows: GridCell[][] };

function height(cell: TableCell): number {
  return cell.inputs.length === 0 ? 0 : 1 + Math.max(...cell.inputs.map(height));
}

function leafCount(cell: TableCell): number {
  return cell.inputs.length === 0 ? 1 : cell.inputs.reduce((sum, input) => sum + leafCount(input), 0);
}

export function layoutTable(cells: TableCell[]): TableLayout {
  const columns = cells.length === 0 ? 0 : 1 + Math.max(...cells.map(height));
  const rows: GridCell[][] = [];

  function place(cell: TableCell, path: string, endCol: number) {
    const col = height(cell);
    const firstRow = rows.length;
    cell.inputs.forEach((input, index) => place(input, `${path}.${index}`, col));
    if (cell.inputs.length === 0) rows.push([]);
    rows[firstRow].push({
      path,
      text: cell.text,
      col,
      colSpan: endCol - col,
      rowSpan: leafCount(cell),
      leaf: cell.inputs.length === 0,
    });
  }

  cells.forEach((cell, index) => place(cell, String(index), columns));
  rows.forEach((cellsInRow) => cellsInRow.sort((a, b) => a.col - b.col));
  return { columns, rows };
}

export function cellAt(cells: TableCell[], path: string): TableCell {
  const [first, ...rest] = path.split('.').map(Number);
  return rest.reduce((cell, index) => cell.inputs[index], cells[first]);
}

export function subtreePaths(cells: TableCell[], path: string): string[] {
  const collect = (cell: TableCell, cellPath: string): string[] => [
    cellPath,
    ...cell.inputs.flatMap((input, index) => collect(input, `${cellPath}.${index}`)),
  ];
  return collect(cellAt(cells, path), path);
}

export function ancestorPaths(path: string): string[] {
  const parts = path.split('.');
  const ancestors: string[] = [];
  for (let i = parts.length - 1; i > 0; i--) {
    ancestors.push(parts.slice(0, i).join('.'));
  }
  return ancestors;
}



export function addRow(cells: TableCell[], text: string): TableCell[] {
  return [...cells, { text, inputs: [], handsOff: false }];
}

export function combine(cells: TableCell[], rootIndices: number[], text: string): TableCell[] {
  const selected = [...rootIndices].sort((a, b) => a - b);
  const combined: TableCell = { text, inputs: selected.map((index) => cells[index]), handsOff: false };
  return cells.flatMap((cell, index) => {
    if (index === selected[0]) return [combined];
    return selected.includes(index) ? [] : [cell];
  });
}

function replaceAt(cells: TableCell[], path: string, replacement: (cell: TableCell) => TableCell[]): TableCell[] {
  const [first, ...rest] = path.split('.').map(Number);
  return cells.flatMap((cell, index) => {
    if (index !== first) return [cell];
    if (rest.length === 0) return replacement(cell);
    return [{ ...cell, inputs: replaceAt(cell.inputs, rest.join('.'), replacement) }];
  });
}

export function rename(cells: TableCell[], path: string, text: string): TableCell[] {
  return replaceAt(cells, path, (cell) => [{ ...cell, text }]);
}

export function setTiming(
  cells: TableCell[],
  path: string,
  timing: Pick<TableCell, 'duration' | 'handsOff'>,
): TableCell[] {
  return replaceAt(cells, path, (cell) => [{ ...cell, ...timing }]);
}

export function remove(cells: TableCell[], path: string): TableCell[] {
  return replaceAt(cells, path, (cell) => cell.inputs);
}
