import { useEffect, useMemo, useRef, useState } from 'react';
import TableGrid, { type CellNote } from '@/components/TableGrid';
import { formatDuration, hasDuration, scheduleTable } from '@/lib/recipe-schedule';
import { ancestorPaths, cellAt, layoutTable, subtreePaths } from '@/lib/recipe-table';

export default function RecipeTable({ cells }: { cells: TableCell[] }) {
  const layout = useMemo(() => layoutTable(cells), [cells]);
  const schedule = useMemo(() => scheduleTable(cells), [cells]);
  const timed = useMemo(() => hasDuration(cells), [cells]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [fullScreen, setFullScreen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  function toggle(path: string) {
    const wasDone = done.has(path);
    const next = new Set(done);
    if (wasDone) {
      next.delete(path);
      ancestorPaths(path).forEach((ancestor) => next.delete(ancestor));
    } else {
      subtreePaths(cells, path).forEach((donePath) => next.add(donePath));
    }
    setDone(next);

    const table = scroller.current?.querySelector('table');
    const [parent] = ancestorPaths(path);
    if (wasDone || !scroller.current || !table || !parent) return;

    const gridCells = layout.rows.flat();
    const cell = gridCells.find((c) => c.path === path);
    if (!cell) return;
    const columnWidth = table.offsetWidth / layout.columns;
    const textWidth = (inputPath: string) =>
      scroller.current?.querySelector<HTMLSpanElement>(`[data-path="${inputPath}"] span`)?.offsetWidth ?? 0;
    const neededWidth = Math.max(
      ...gridCells
        .filter((c) => ancestorPaths(c.path)[0] === parent)
        .map((input) => Math.min(textWidth(input.path), input.colSpan * columnWidth)),
    );
    const left = Math.max(0, (cell.col + cell.colSpan) * columnWidth - neededWidth);
    scroller.current.scrollTo({ left });
  }

  function cellNote(path: string): CellNote {
    const cell = cellAt(cells, path);
    const timing = schedule.cells.get(path);
    const lines: string[] = [];
    if (cell.duration || cell.handsOff) {
      lines.push([cell.duration && formatDuration(cell.duration), cell.handsOff && 'hands-off'].filter(Boolean).join(' · '));
    }
    const isStep = cell.inputs.length > 0 || cell.duration !== undefined;
    if (!timed || !timing || !isStep || done.has(path)) return { lines };
    if (timing.startOffset > 0) lines.push(`start ${timing.startsBeforeEnd} min before end`);
    return { lines, emphasis: timing.critical ? 'on the critical path' : undefined };
  }

  function toggleFullScreen() {
    if (fullScreen) {
      if (document.fullscreenElement) document.exitFullscreen();
      else setFullScreen(false);
      return;
    }
    const wrapper = wrapperRef.current;
    if (document.fullscreenEnabled && wrapper?.requestFullscreen) {
      wrapper.requestFullscreen().catch(() => setFullScreen(true));
    } else {
      setFullScreen(true);
    }
  }

  useEffect(() => {
    const syncWithBrowser = () => setFullScreen(document.fullscreenElement === wrapperRef.current);
    document.addEventListener('fullscreenchange', syncWithBrowser);
    return () => document.removeEventListener('fullscreenchange', syncWithBrowser);
  }, []);

  return (
    <div ref={wrapperRef} className={fullScreen ? 'fixed inset-0 z-50 flex flex-col gap-2 bg-black p-2' : 'grid gap-2'}>
      <button
        type="button"
        onClick={toggleFullScreen}
        className="w-fit rounded border-2 border-secondary px-2 py-1 text-sm whitespace-nowrap"
      >
        {fullScreen ? 'Exit full screen' : 'Full screen'}
      </button>
      {timed && <p className="font-semibold">Total {schedule.total} min</p>}
      <TableGrid
        layout={layout}
        label="Method"
        pressed={done}
        pressedClassName="bg-[#e5e5e5] text-[#555] line-through"
        onCellClick={toggle}
        cellNote={cellNote}
        scrollerRef={scroller}
        className={fullScreen ? 'min-h-0 flex-1 overflow-y-auto' : ''}
      />
    </div>
  );
}
