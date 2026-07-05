// Built from Y/M/D parts (not toISOString, which converts to UTC and can land
// on the wrong local calendar day) so a date reads as the same day everywhere.
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Monday of the week containing `date` (getDay() is 0=Sun..6=Sat, so Sunday
// needs a 6-day rewind while every other day rewinds to `day - 1`).
export function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  return addDays(d, day === 0 ? -6 : 1 - day);
}

export function firstOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

// Weeks (Monday-first) spanning the calendar month that contains `monthDate`,
// including the leading/trailing days of neighbouring months needed to fill
// each row.
export function weeksInMonth(monthDate: Date): Date[][] {
  const firstDay = firstOfMonth(monthDate);
  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const gridStart = mondayOf(firstDay);
  const weeks: Date[][] = [];
  let cursor = gridStart;
  while (cursor <= lastDay) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)));
    cursor = addDays(cursor, 7);
  }
  return weeks;
}
