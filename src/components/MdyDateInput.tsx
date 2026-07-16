import { useRef, useState } from 'react';
import { parseMonth } from '@/lib/parseMonth';

// Most food packaging prints dates as DD/MM/YYYY (UK/most-of-world order), but the
// native <input type="date"> picker forces users to navigate a calendar/month-name
// UI to enter one. This gives three plain fields instead, in that same order, so a
// printed date can be typed as printed — including month names ("FEB") where that's
// what the packaging shows; parseMonth converts them to the ISO month number.
// TODO: pick the segment order from the user's locale instead of hardcoding UK.
export default function MdyDateInput({
  idPrefix,
  value,
  onChange,
  required,
  inputClassName,
}: {
  idPrefix: string;
  value: string;
  onChange: (isoDate: string) => void;
  required?: boolean;
  inputClassName: string;
}) {
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  // Tracks which `value` the segments above were last derived from, so a prop
  // change (including the initial mount, where this starts as `null` and never
  // matches `value`) can be detected and applied during render — not via an
  // effect, which would cause an extra commit/cascading render per keystroke.
  const [syncedValue, setSyncedValue] = useState<string | null>(null);

  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  // The value this component itself last emitted. Controlled parents echo that
  // straight back as the next `value` prop; without this the echo would count as
  // an external change and rewrite the segments under the user's cursor ("feb" →
  // "02" mid-word, or every segment wiped when one digit is deleted). State (not
  // a ref) because it's read during render, alongside syncedValue.
  const [lastEmitted, setLastEmitted] = useState<string | null>(null);

  // Keep the segments in sync if the parent resets/loads `value` externally.
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (value !== lastEmitted) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      if (match) {
        setYear(match[1]);
        setMonth(match[2]);
        setDay(match[3]);
      } else if (value === '') {
        setDay('');
        setMonth('');
        setYear('');
      }
    }
  }

  function emit(nextDay: string, nextMonth: string, nextYear: string) {
    const monthNumber = parseMonth(nextMonth);
    const dayNumber = Number(nextDay);
    const emitted =
      nextDay.length >= 1 && dayNumber >= 1 && monthNumber !== null && nextYear.length === 4
        ? `${nextYear}-${String(monthNumber).padStart(2, '0')}-${nextDay.padStart(2, '0')}`
        : '';
    setLastEmitted(emitted);
    onChange(emitted);
  }

  function handleDayChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 2);
    setDay(digits);
    emit(digits, month, year);
    if (digits.length === 2) monthRef.current?.focus();
  }

  // The month is free text (digits or a name, as printed on the packaging). Only a
  // 2-digit month auto-advances — a resolved name prefix like "feb" must not steal
  // focus mid-way through someone typing "february".
  function handleMonthChange(raw: string) {
    const cleaned = raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, 9);
    setMonth(cleaned);
    emit(day, cleaned, year);
    if (/^\d{2}$/.test(cleaned)) yearRef.current?.focus();
  }

  function handleYearChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    setYear(digits);
    emit(day, month, digits);
  }

  return (
    <div className="flex items-center gap-2">
      <input
        id={`${idPrefix}-day`}
        type="text"
        inputMode="numeric"
        placeholder="DD"
        aria-label="Day"
        maxLength={2}
        value={day}
        onChange={(e) => handleDayChange(e.target.value)}
        required={required}
        className={`${inputClassName} w-14 text-center`}
      />
      <span aria-hidden="true">/</span>
      <input
        id={`${idPrefix}-month`}
        ref={monthRef}
        type="text"
        placeholder="MM"
        aria-label="Month"
        maxLength={9}
        value={month}
        onChange={(e) => handleMonthChange(e.target.value)}
        required={required}
        className={`${inputClassName} w-20 text-center`}
      />
      <span aria-hidden="true">/</span>
      <input
        id={`${idPrefix}-year`}
        ref={yearRef}
        type="text"
        inputMode="numeric"
        placeholder="YYYY"
        aria-label="Year"
        maxLength={4}
        value={year}
        onChange={(e) => handleYearChange(e.target.value)}
        required={required}
        className={`${inputClassName} w-20 text-center`}
      />
    </div>
  );
}
