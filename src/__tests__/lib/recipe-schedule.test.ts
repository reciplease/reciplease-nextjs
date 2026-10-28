import { formatDuration, hasDuration, scheduleTable } from '@/lib/recipe-schedule';

const plain = (text: string, ...inputs: TableCell[]): TableCell => ({ text, inputs, handsOff: false });
const timed = (text: string, maxMinutes: number, ...inputs: TableCell[]): TableCell => ({
  text,
  inputs,
  handsOff: false,
  duration: { minMinutes: maxMinutes, maxMinutes },
});

const pie = [
  timed(
    'bake',
    25,
    plain('mash', timed('boil', 20, plain('potato'))),
    plain('stir', timed('cook', 10, plain('mince'))),
  ),
];

describe('scheduleTable', () => {
  it('totals the longest chain from a leaf to the end', () => {
    expect(scheduleTable(pie).total).toBe(45);
  });

  it('starts the longest branch at 0 and the shorter one later so both finish when the next step starts', () => {
    const { cells } = scheduleTable(pie);

    expect(cells.get('0.0.0')).toMatchObject({ startOffset: 0, finishOffset: 20, startsBeforeEnd: 45 });
    expect(cells.get('0.1.0')).toMatchObject({ startOffset: 10, finishOffset: 20, startsBeforeEnd: 35 });
    expect(cells.get('0')).toMatchObject({ startOffset: 20, finishOffset: 45, startsBeforeEnd: 25 });
  });

  it('marks only the longest chain as critical', () => {
    const { cells } = scheduleTable(pie);

    expect(cells.get('0')?.critical).toBe(true);
    expect(cells.get('0.0')?.critical).toBe(true);
    expect(cells.get('0.0.0')?.critical).toBe(true);
    expect(cells.get('0.0.0.0')?.critical).toBe(true);
    expect(cells.get('0.1.0')?.critical).toBe(false);
    expect(cells.get('0.1')?.critical).toBe(false);
    expect(cells.get('0.1.0.0')?.critical).toBe(false);
  });

  it('marks every equal-length branch as critical', () => {
    const { cells } = scheduleTable([timed('bake', 25, timed('boil', 20, plain('potato')), timed('roast', 20, plain('veg')))]);

    expect(cells.get('0.0')).toMatchObject({ startOffset: 0, critical: true });
    expect(cells.get('0.1')).toMatchObject({ startOffset: 0, critical: true });
  });

  it('treats cells without a duration as taking no time', () => {
    const { total, cells } = scheduleTable([plain('serve', plain('mix', plain('flour')))]);

    expect(total).toBe(0);
    expect(cells.get('0.0')).toMatchObject({ startOffset: 0, finishOffset: 0, startsBeforeEnd: 0 });
  });

  it('uses the longest end of a range', () => {
    const range: TableCell = { ...plain('roast'), duration: { minMinutes: 12, maxMinutes: 15 } };

    expect(scheduleTable([range]).total).toBe(15);
  });

  it('finishes every root at the end, shifting shorter roots later', () => {
    const { total, cells } = scheduleTable([timed('bake', 30), timed('whisk', 5)]);

    expect(total).toBe(30);
    expect(cells.get('0')).toMatchObject({ startOffset: 0, critical: true });
    expect(cells.get('1')).toMatchObject({ startOffset: 25, finishOffset: 30, startsBeforeEnd: 5, critical: false });
  });

  it('schedules an empty table', () => {
    expect(scheduleTable([])).toEqual({ total: 0, cells: new Map() });
  });
});

describe('hasDuration', () => {
  it('finds a duration on any cell, however deep', () => {
    expect(hasDuration(pie)).toBe(true);
    expect(hasDuration([plain('a', plain('b', timed('c', 1)))])).toBe(true);
  });

  it('is false when no cell has a duration', () => {
    expect(hasDuration([plain('a', plain('b'))])).toBe(false);
    expect(hasDuration([])).toBe(false);
  });
});

describe('formatDuration', () => {
  it('shows a range as min–max minutes', () => {
    expect(formatDuration({ minMinutes: 15, maxMinutes: 20 })).toBe('15–20 min');
  });

  it('shows a single time once', () => {
    expect(formatDuration({ minMinutes: 10, maxMinutes: 10 })).toBe('10 min');
  });
});
