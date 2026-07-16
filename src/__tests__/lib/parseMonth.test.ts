import { parseMonth } from '@/lib/parseMonth';

describe('parseMonth', () => {
  it.each([
    ['1', 1],
    ['01', 1],
    ['2', 2],
    ['02', 2],
    ['12', 12],
  ])('parses numeric input %s as month %i', (input, expected) => {
    expect(parseMonth(input)).toBe(expected);
  });

  it.each([
    ['FEB', 2],
    ['feb', 2],
    ['Feb', 2],
    ['february', 2],
    ['FEBRUARY', 2],
    ['jan', 1],
    ['mar', 3],
    ['apr', 4],
    ['may', 5],
    ['jun', 6],
    ['jul', 7],
    ['aug', 8],
    ['sep', 9],
    ['sept', 9],
    ['oct', 10],
    ['nov', 11],
    ['dec', 12],
    ['dece', 12],
  ])('parses month name %s as month %i', (input, expected) => {
    expect(parseMonth(input)).toBe(expected);
  });

  it('trims surrounding whitespace', () => {
    expect(parseMonth(' feb ')).toBe(2);
  });

  it.each([
    [''], // empty
    ['0'], // out of range
    ['13'], // out of range
    ['123'], // too many digits
    ['xyz'], // not a month
    ['ju'], // ambiguous prefix (june/july) and too short anyway
    ['ma'], // ambiguous prefix (march/may) and too short anyway
    ['j'], // too short
    ['janx'], // not a prefix of january
    ['2b'], // mixed digits and letters
  ])('returns null for invalid input %s', (input) => {
    expect(parseMonth(input)).toBeNull();
  });
});
