export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// `undefined` locale means "use the browser's" — no i18n library needed for
// this, toLocaleDateString already covers it. Built from the Y/M/D parts
// (not `new Date(dateOnly)`, which treats a date-only string as UTC midnight
// and can land on the wrong local calendar day) so a date like "2026-07-14"
// reads as July 14th everywhere, not occasionally July 13th.
export function formatDate(dateOnly: string): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { dateStyle: 'medium' });
}
