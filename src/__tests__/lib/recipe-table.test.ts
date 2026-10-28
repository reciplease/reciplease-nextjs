import {
  addRow,
  ancestorPaths,
  combine,
  layoutTable,
  remove,
  rename,
  setTiming,
  subtreePaths,
} from '@/lib/recipe-table';

const row = (text: string): TableCell => ({ text, inputs: [], handsOff: false });
const step = (text: string, ...inputs: TableCell[]): TableCell => ({ text, inputs, handsOff: false });

const toast = [step('spread', step('toast', row('bread')), row('butter'))];

describe('layoutTable', () => {
  it('puts each cell in the row of its first leaf, spanning its leaves and reaching its parent', () => {
    const layout = layoutTable(toast);

    expect(layout.columns).toBe(3);
    expect(layout.rows).toEqual([
      [
        { path: '0.0.0', text: 'bread', col: 0, colSpan: 1, rowSpan: 1, leaf: true },
        { path: '0.0', text: 'toast', col: 1, colSpan: 1, rowSpan: 1, leaf: false },
        { path: '0', text: 'spread', col: 2, colSpan: 1, rowSpan: 2, leaf: false },
      ],
      [{ path: '0.1', text: 'butter', col: 0, colSpan: 2, rowSpan: 1, leaf: true }],
    ]);
  });

  it('stretches shorter roots to the last column so there are no gaps', () => {
    const layout = layoutTable([step('toast', row('bread')), row('butter')]);

    expect(layout.columns).toBe(2);
    expect(layout.rows[1]).toEqual([
      { path: '1', text: 'butter', col: 0, colSpan: 2, rowSpan: 1, leaf: true },
    ]);
  });

  it('fills every grid slot exactly once', () => {
    const cells = [
      step('bake', step('mix', row('a'), step('melt', row('b'))), step('preheat', row('oven'))),
      row('garnish'),
    ];
    const layout = layoutTable(cells);
    const filled = new Map<string, number>();
    layout.rows.forEach((cellsInRow, rowIndex) =>
      cellsInRow.forEach((cell) => {
        for (let r = rowIndex; r < rowIndex + cell.rowSpan; r++)
          for (let c = cell.col; c < cell.col + cell.colSpan; c++)
            filled.set(`${r},${c}`, (filled.get(`${r},${c}`) ?? 0) + 1);
      }),
    );

    expect(filled.size).toBe(layout.rows.length * layout.columns);
    expect(Array.from(filled.values()).every((count) => count === 1)).toBe(true);
  });

  it('lays out an empty table', () => {
    expect(layoutTable([])).toEqual({ columns: 0, rows: [] });
  });
});

describe('subtreePaths', () => {
  it('returns the cell and everything that feeds into it', () => {
    expect(subtreePaths(toast, '0.0')).toEqual(['0.0', '0.0.0']);
  });
});

describe('ancestorPaths', () => {
  it('returns ancestors from closest to root', () => {
    expect(ancestorPaths('0.0.1')).toEqual(['0.0', '0']);
  });

  it('returns empty array for a root cell', () => {
    expect(ancestorPaths('0')).toEqual([]);
  });
});



describe('editing', () => {
  it('adds a row at the bottom', () => {
    expect(addRow([row('bread')], 'butter')).toEqual([row('bread'), row('butter')]);
  });

  it('combines roots into a new step at the first one, in row order', () => {
    const cells = [row('a'), row('b'), row('c'), row('d')];

    expect(combine(cells, [3, 1], 'mix')).toEqual([row('a'), step('mix', row('b'), row('d')), row('c')]);
  });

  it('applies a step to a single root', () => {
    expect(combine([row('butter')], [0], 'melt')).toEqual([step('melt', row('butter'))]);
  });

  it('renames any cell', () => {
    expect(rename(toast, '0.0', 'grill')).toEqual([
      step('spread', step('grill', row('bread')), row('butter')),
    ]);
  });

  it('keeps the duration and hands-off flag when renaming', () => {
    const bake: TableCell = { ...step('bake', row('dough')), duration: { minMinutes: 20, maxMinutes: 25 }, handsOff: true };

    expect(rename([bake], '0', 'roast')).toEqual([{ ...bake, text: 'roast' }]);
  });

  it('sets a duration and hands-off flag on any cell', () => {
    const duration = { minMinutes: 5, maxMinutes: 10 };

    expect(setTiming(toast, '0.0', { duration, handsOff: true })).toEqual([
      step('spread', { ...step('toast', row('bread')), duration, handsOff: true }, row('butter')),
    ]);
  });

  it('clears a duration', () => {
    const timedCell: TableCell = { ...row('bread'), duration: { minMinutes: 5, maxMinutes: 10 } };

    expect(setTiming([timedCell], '0', { duration: undefined, handsOff: false })).toEqual([
      { ...row('bread'), duration: undefined },
    ]);
  });

  it('removing a step puts its inputs back in its place', () => {
    expect(remove(toast, '0.0')).toEqual([step('spread', row('bread'), row('butter'))]);
    expect(remove(toast, '0')).toEqual([step('toast', row('bread')), row('butter')]);
  });

  it('removes an unused row', () => {
    expect(remove([row('bread'), row('butter')], '0')).toEqual([row('butter')]);
  });
});
