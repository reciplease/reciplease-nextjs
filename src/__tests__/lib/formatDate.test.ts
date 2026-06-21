import { formatTimestamp } from '@/lib/formatDate';

describe('formatTimestamp', () => {
  it('formats an ISO timestamp as a localized date and time', () => {
    const iso = '2026-06-10T12:34:00.000Z';

    expect(formatTimestamp(iso)).toBe(
      new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
    );
  });
});
