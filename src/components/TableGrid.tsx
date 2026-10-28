import type { Ref } from 'react';
import type { TableLayout } from '@/lib/recipe-table';

export type CellNote = { lines: string[]; emphasis?: string };

type Props = {
  layout: TableLayout;
  label: string;
  pressed: Set<string>;
  pressedClassName: string;
  onCellClick: (path: string) => void;
  cellNote?: (path: string) => CellNote;
  scrollerRef?: Ref<HTMLDivElement>;
  className?: string;
};

const noNote: CellNote = { lines: [] };

export default function TableGrid({
  layout,
  label,
  pressed,
  pressedClassName,
  onCellClick,
  cellNote = () => noNote,
  scrollerRef,
  className = '',
}: Props) {
  return (
    <div ref={scrollerRef} role="region" aria-label={label} className={`overflow-x-auto scroll-smooth ${className}`}>
      <table className="table-fixed border-collapse" style={{ width: `${layout.columns * 9}rem` }}>
        <tbody>
          {layout.rows.map((cellsInRow, rowIndex) => (
            <tr key={rowIndex}>
              {cellsInRow.map((cell) => {
                const isPressed = pressed.has(cell.path);
                const { lines, emphasis } = cellNote(cell.path);
                return (
                  <td
                    key={cell.path}
                    data-col={cell.col}
                    data-path={cell.path}
                    rowSpan={cell.rowSpan}
                    colSpan={cell.colSpan}
                    className={`h-px border border-[#999] p-0 ${isPressed ? pressedClassName : ''}`}
                  >
                    <button
                      type="button"
                      aria-pressed={isPressed}
                      onClick={() => onCellClick(cell.path)}
                      title={emphasis}
                      className={`flex h-full w-full items-center rounded-none border-0 p-0 text-left hover:bg-black/5 hover:text-inherit ${
                        emphasis ? 'border-l-8 border-highlight' : ''
                      }`}
                    >
                      <span className="sticky left-0 max-w-[40ch] px-2 py-1">
                        {cell.text}
                        {emphasis && <span className="sr-only">, {emphasis}</span>}
                        {lines.map((line) => (
                          <span key={line} className="block text-sm">
                            {line}
                          </span>
                        ))}
                      </span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
