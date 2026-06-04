import { parseDate } from '@/lib/parseDate';

describe('parseDate', () => {
  it('parses DD/MM/YYYY', () => {
    expect(parseDate('Best before 31/12/2026')).toBe('2026-12-31');
  });

  it('parses DD-MM-YYYY', () => {
    expect(parseDate('USE BY 01-06-2027')).toBe('2027-06-01');
  });

  it('parses MM/YYYY', () => {
    expect(parseDate('EXP 06/2026')).toBe('2026-06-01');
  });

  it('parses DD MMM YYYY', () => {
    expect(parseDate('Best Before 12 Jan 2027')).toBe('2027-01-12');
  });

  it('parses MMM YYYY', () => {
    expect(parseDate('Use By Dec 2026')).toBe('2026-12-01');
  });

  it('parses YYYY-MM-DD', () => {
    expect(parseDate('2026-11-30')).toBe('2026-11-30');
  });

  it('returns null when no date found', () => {
    expect(parseDate('No date here at all')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseDate('')).toBeNull();
  });

  it('is case-insensitive for month names', () => {
    expect(parseDate('best before JAN 2027')).toBe('2027-01-01');
  });
});
