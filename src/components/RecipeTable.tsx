import { useEffect, useMemo, useRef, useState } from 'react';
import TableGrid, { type CellNote } from '@/components/TableGrid';
import { createDing } from '@/lib/ding';
import { formatRemaining, formatDuration, hasDuration, scheduleTable } from '@/lib/recipe-schedule';
import { ancestorPaths, cellAt, layoutTable, subtreePaths } from '@/lib/recipe-table';

export default function RecipeTable({ cells }: { cells: TableCell[] }) {
  const layout = useMemo(() => layoutTable(cells), [cells]);
  const schedule = useMemo(() => scheduleTable(cells), [cells]);
  const timed = useMemo(() => hasDuration(cells), [cells]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [fullScreen, setFullScreen] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const ding = useRef<() => void>(() => {});
  const lastElapsed = useRef(0);
  const startedAt = useRef(0);
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
      skipTimerTo((schedule.cells.get(path)?.finishOffset ?? 0) * 60);
    }
    setDone(next);
    scrollPastFinishedColumns(next);
  }

  function scrollPastFinishedColumns(donePaths: Set<string>) {
    const table = scroller.current?.querySelector('table');
    if (!scroller.current || !table) return;
    const unfinished = layout.rows.flat().filter((c) => !donePaths.has(c.path));
    if (unfinished.length === 0) return;
    const firstUnfinishedColumn = Math.min(...unfinished.map((c) => c.col));
    scroller.current.scrollTo({ left: firstUnfinishedColumn * (table.offsetWidth / layout.columns) });
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
    if (elapsed !== null) {
      const untilStart = timing.startOffset * 60 - elapsed;
      lines.push(untilStart > 0 ? `start in ${formatRemaining(untilStart)}` : 'start now');
    }
    return { lines, emphasis: timing.critical ? 'on the critical path' : undefined };
  }

  function toggleTimer() {
    if (elapsed !== null) {
      setElapsed(null);
      return;
    }
    ding.current = createDing();
    lastElapsed.current = 0;
    startedAt.current = Date.now();
    setElapsed(0);
  }

  function skipTimerTo(seconds: number) {
    if (elapsed === null || seconds <= elapsed) return;
    startedAt.current = Date.now() - seconds * 1000;
    setElapsed(seconds);
  }

  const running = elapsed !== null;
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (elapsed === null) return;
    const previous = lastElapsed.current;
    lastElapsed.current = elapsed;
    const startsNow = Array.from(schedule.cells).some(
      ([path, timing]) =>
        timing.startOffset > 0 &&
        !done.has(path) &&
        previous < timing.startOffset * 60 &&
        timing.startOffset * 60 <= elapsed,
    );
    if (startsNow) ding.current();
  }, [elapsed, done, schedule.cells]);

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
      {timed && (
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggleTimer}
            className="w-fit rounded border-2 border-secondary px-2 py-1 text-sm whitespace-nowrap"
          >
            {elapsed === null ? 'Start recipe timer' : 'Stop recipe timer'}
          </button>
          <p className="font-semibold">
            {elapsed === null
              ? `Total ${schedule.total} min`
              : `Time left ${formatRemaining(schedule.total * 60 - elapsed)}`}
          </p>
        </div>
      )}
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
