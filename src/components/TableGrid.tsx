import type { Ref } from 'react';
import type { TableLayout } from '@/lib/recipe-table';

type Props = {
  layout: TableLayout;
  label: string;
  pressed: Set<string>;
  pressedClassName: string;
  onCellClick: (path: string) => void;
  scrollerRef?: Ref<HTMLDivElement>;
  className?: string;
};

export default function TableGrid({
  layout,
  label,
  pressed,
  pressedClassName,
  onCellClick,
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
                return (
                  <td
                    key={cell.path}
                    data-col={cell.col}
                    rowSpan={cell.rowSpan}
                    colSpan={cell.colSpan}
                    className={`h-px border border-[#999] p-0 ${isPressed ? pressedClassName : ''}`}
                  >
                    <button
                      type="button"
                      aria-pressed={isPressed}
                      onClick={() => onCellClick(cell.path)}
                      className="flex h-full w-full items-center rounded-none border-0 p-0 text-left hover:bg-black/5 hover:text-inherit"
                    >
                      <span className="sticky left-0 px-2 py-1">{cell.text}</span>
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
