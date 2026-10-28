import { useEffect, useMemo, useRef, useState } from 'react';
import TableGrid from '@/components/TableGrid';
import { ancestorPaths, layoutTable, subtreePaths } from '@/lib/recipe-table';

export default function RecipeTable({ cells }: { cells: TableCell[] }) {
  const layout = useMemo(() => layoutTable(cells), [cells]);
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
    if (wasDone || !scroller.current || !table) return;

    const cell = layout.rows.flat().find((c) => c.path === path);
    if (!cell) return;
    const lastColumn = cell.col + cell.colSpan - 1;
    if (lastColumn >= layout.columns - 1) return;
    const left = lastColumn * (table.offsetWidth / layout.columns);
    scroller.current.scrollTo({ left });
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
      <TableGrid
        layout={layout}
        label="Method"
        pressed={done}
        pressedClassName="bg-[#e5e5e5] text-[#888] line-through"
        onCellClick={toggle}
        scrollerRef={scroller}
        className={fullScreen ? 'min-h-0 flex-1 overflow-y-auto' : ''}
      />
    </div>
  );
}
