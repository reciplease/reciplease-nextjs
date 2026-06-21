import { formatDate, formatTimestamp } from '@/lib/formatDate';

describe('formatTimestamp', () => {
  it('formats an ISO timestamp as a localized date and time', () => {
    const iso = '2026-06-10T12:34:00.000Z';

    expect(formatTimestamp(iso)).toBe(
      new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
    );
  });
});

describe('formatDate', () => {
  it('formats a date-only string as a localized date', () => {
    expect(formatDate('2026-07-14')).toBe(
      new Date(2026, 6, 14).toLocaleDateString(undefined, { dateStyle: 'medium' }),
    );
  });

  it('does not shift to the previous day in a positive-UTC-offset timezone', () => {
    // new Date('2026-01-01') is parsed as UTC midnight; in a timezone ahead of
    // UTC, naively clamping to local midnight could read back as Dec 31.
    expect(formatDate('2026-01-01')).toBe(
      new Date(2026, 0, 1).toLocaleDateString(undefined, { dateStyle: 'medium' }),
    );
  });
});
