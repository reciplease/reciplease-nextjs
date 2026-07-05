import { addDays, firstOfMonth, mondayOf, toIsoDate, weeksInMonth } from '@/lib/week';

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

describe('firstOfMonth', () => {
  it('returns the 1st of the month containing the given date', () => {
    expect(toIsoDate(firstOfMonth(new Date(2026, 5, 18)))).toBe('2026-06-01');
  });
});

describe('weeksInMonth', () => {
  it('starts the grid on the Monday of the week containing the 1st', () => {
    // June 2026 starts on a Monday, so no leading days are needed.
    const weeks = weeksInMonth(new Date(2026, 5, 1));
    expect(toIsoDate(weeks[0][0])).toBe('2026-06-01');
  });

  it('pads the final week with leading days of the next month', () => {
    // June 2026 ends on a Tuesday, so the last row spans into July.
    const weeks = weeksInMonth(new Date(2026, 5, 1));
    const lastWeek = weeks[weeks.length - 1];
    expect(toIsoDate(lastWeek[0])).toBe('2026-06-29');
    expect(toIsoDate(lastWeek[6])).toBe('2026-07-05');
  });

  it('includes leading days of the previous month when the 1st is not a Monday', () => {
    // July 2026 starts on a Wednesday.
    const weeks = weeksInMonth(new Date(2026, 6, 1));
    expect(toIsoDate(weeks[0][0])).toBe('2026-06-29');
  });
});
