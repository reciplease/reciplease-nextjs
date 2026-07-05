import { addDays, mondayOf, toIsoDate } from '@/lib/week';

describe('mondayOf', () => {
  it('returns the same date when already a Monday', () => {
    expect(toIsoDate(mondayOf(new Date(2026, 5, 1)))).toBe('2026-06-01');
  });

  it('rewinds to Monday for a mid-week date', () => {
    expect(toIsoDate(mondayOf(new Date(2026, 5, 4)))).toBe('2026-06-01');
  });

  it('rewinds a Sunday to the Monday six days earlier, not the same day', () => {
    expect(toIsoDate(mondayOf(new Date(2026, 5, 7)))).toBe('2026-06-01');
  });
});

describe('addDays', () => {
  it('advances across a month boundary', () => {
    expect(toIsoDate(addDays(new Date(2026, 5, 29), 3))).toBe('2026-07-02');
  });
});

describe('toIsoDate', () => {
  it('formats using local date parts, not UTC', () => {
    // A date constructed from Y/M/D is local midnight; toISOString() would
    // shift this to the previous day in any timezone ahead of UTC.
    expect(toIsoDate(new Date(2026, 0, 1))).toBe('2026-01-01');
  });
});
