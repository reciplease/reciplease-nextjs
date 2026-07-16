const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

// Parses the month as printed on food packaging: either digits ("2", "02") or an
// English month name/abbreviation ("FEB", "Feb", "february"). Name matching needs at
// least 3 letters so ambiguous prefixes like "ju" never resolve; "sept" is special-cased
// as a common non-prefix abbreviation. Returns 1-12, or null when the input doesn't
// (yet) resolve to a single month.
export function parseMonth(input: string): number | null {
  const trimmed = input.trim();

  if (/^\d{1,2}$/.test(trimmed)) {
    const numeric = parseInt(trimmed, 10);
    return numeric >= 1 && numeric <= 12 ? numeric : null;
  }

  if (!/^[a-zA-Z]{3,}$/.test(trimmed)) return null;

  const lower = trimmed.toLowerCase();
  if (lower === 'sept') return 9;

  const matches = MONTH_NAMES.filter((name) => name.startsWith(lower));
  if (matches.length !== 1) return null;
  return MONTH_NAMES.indexOf(matches[0]) + 1;
}
