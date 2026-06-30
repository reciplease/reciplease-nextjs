import { useRef, useState } from 'react';

// Most food packaging prints dates as DD/MM/YYYY (UK/most-of-world order), but the
// native <input type="date"> picker forces users to navigate a calendar/month-name
// UI to enter one. This gives three plain numeric fields instead, in that same
// order, so a printed date can be typed digit-for-digit.
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

  // Keep the segments in sync if the parent resets/loads `value` externally.
  if (value !== syncedValue) {
    setSyncedValue(value);
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

  function emit(nextDay: string, nextMonth: string, nextYear: string) {
    if (nextDay.length === 2 && nextMonth.length === 2 && nextYear.length === 4) {
      onChange(`${nextYear}-${nextMonth}-${nextDay}`);
    } else {
      onChange('');
    }
  }

  function handleDayChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 2);
    setDay(digits);
    emit(digits, month, year);
    if (digits.length === 2) monthRef.current?.focus();
  }

  function handleMonthChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 2);
    setMonth(digits);
    emit(day, digits, year);
    if (digits.length === 2) yearRef.current?.focus();
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
        inputMode="numeric"
        placeholder="MM"
        aria-label="Month"
        maxLength={2}
        value={month}
        onChange={(e) => handleMonthChange(e.target.value)}
        required={required}
        className={`${inputClassName} w-14 text-center`}
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
