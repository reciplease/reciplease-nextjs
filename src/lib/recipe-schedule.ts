export type CellSchedule = {
  startOffset: number;
  finishOffset: number;
  startsBeforeEnd: number;
  critical: boolean;
};

export type Schedule = { total: number; cells: Map<string, CellSchedule> };

const minutes = (cell: TableCell): number => cell.duration?.maxMinutes ?? 0;

function earliestFinish(cell: TableCell): number {
  return minutes(cell) + Math.max(0, ...cell.inputs.map(earliestFinish));
}

export function scheduleTable(cells: TableCell[]): Schedule {
  const total = Math.max(0, ...cells.map(earliestFinish));
  const scheduled = new Map<string, CellSchedule>();

  function place(cell: TableCell, path: string, finishOffset: number) {
    const startOffset = finishOffset - minutes(cell);
    scheduled.set(path, {
      startOffset,
      finishOffset,
      startsBeforeEnd: total - startOffset,
      critical: finishOffset === earliestFinish(cell),
    });
    cell.inputs.forEach((input, index) => place(input, `${path}.${index}`, startOffset));
  }

  cells.forEach((cell, index) => place(cell, String(index), total));
  return { total, cells: scheduled };
}

export function hasDuration(cells: TableCell[]): boolean {
  return cells.some((cell) => cell.duration !== undefined || hasDuration(cell.inputs));
}

export function formatDuration({ minMinutes, maxMinutes }: NonNullable<TableCell['duration']>): string {
  return minMinutes === maxMinutes ? `${maxMinutes} min` : `${minMinutes}–${maxMinutes} min`;
}
