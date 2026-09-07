import { Fragment, useState, useSyncExternalStore } from 'react';
import { parseMonth } from '@/lib/parseMonth';

type Segment = 'day' | 'month' | 'year';

const FALLBACK_ORDER: Segment[] = ['day', 'month', 'year'];

let cachedOrder: { locale: string; order: Segment[] } | null = null;

function isSegment(type: string): type is Segment {
  return type === 'day' || type === 'month' || type === 'year';
}

function localeSegmentOrder(): Segment[] {
  const locale = typeof navigator === 'undefined' ? '' : navigator.language;
  if (cachedOrder?.locale !== locale) {
    const order = new Intl.DateTimeFormat(locale || undefined, {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    })
      .formatToParts(new Date())
      .map((part) => part.type)
      .filter(isSegment);
    cachedOrder = { locale, order: order.length === 3 ? order : FALLBACK_ORDER };
  }
  return cachedOrder.order;
}

const noopSubscribe = () => () => {};

// Most food packaging prints the date in the reader's local order, but the native
// <input type="date"> picker forces users to navigate a calendar/month-name UI to
// enter one. This gives three plain fields instead, in the locale's own order, so a
// printed date can be typed as printed — including month names ("FEB") where that's
// what the packaging shows; parseMonth converts them to the ISO month number.
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
  const order = useSyncExternalStore(noopSubscribe, localeSegmentOrder, () => FALLBACK_ORDER);

  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  // Tracks which `value` the segments above were last derived from, so a prop
  // change (including the initial mount, where this starts as `null` and never
  // matches `value`) can be detected and applied during render — not via an
  // effect, which would cause an extra commit/cascading render per keystroke.
  const [syncedValue, setSyncedValue] = useState<string | null>(null);

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

  function focusNext(segment: Segment) {
    const next = order[order.indexOf(segment) + 1];
    if (next) document.getElementById(`${idPrefix}-${next}`)?.focus();
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
    if (digits.length === 2) focusNext('day');
  }

  // The month is free text (digits or a name, as printed on the packaging). Only a
  // 2-digit month auto-advances — a resolved name prefix like "feb" must not steal
  // focus mid-way through someone typing "february".
  function handleMonthChange(raw: string) {
    const cleaned = raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, 9);
    setMonth(cleaned);
    emit(day, cleaned, year);
    if (/^\d{2}$/.test(cleaned)) focusNext('month');
  }

  function handleYearChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    setYear(digits);
    emit(day, month, digits);
    if (digits.length === 4) focusNext('year');
  }

  const fields: Record<
    Segment,
    {
      label: string;
      placeholder: string;
      value: string;
      maxLength: number;
      width: string;
      numeric: boolean;
      onValueChange: (raw: string) => void;
    }
  > = {
    day: {
      label: 'Day',
      placeholder: 'DD',
      value: day,
      maxLength: 2,
      width: 'w-14',
      numeric: true,
      onValueChange: handleDayChange,
    },
    month: {
      label: 'Month',
      placeholder: 'MM',
      value: month,
      maxLength: 9,
      width: 'w-20',
      numeric: false,
      onValueChange: handleMonthChange,
    },
    year: {
      label: 'Year',
      placeholder: 'YYYY',
      value: year,
      maxLength: 4,
      width: 'w-20',
      numeric: true,
      onValueChange: handleYearChange,
    },
  };

  return (
    <div className="flex items-center gap-2">
      {order.map((segment, index) => {
        const field = fields[segment];
        return (
          <Fragment key={segment}>
            {index > 0 && <span aria-hidden="true">/</span>}
            <input
              id={`${idPrefix}-${segment}`}
              type="text"
              inputMode={field.numeric ? 'numeric' : undefined}
              placeholder={field.placeholder}
              aria-label={field.label}
              maxLength={field.maxLength}
              value={field.value}
              onChange={(e) => field.onValueChange(e.target.value)}
              required={required}
              className={`${inputClassName} ${field.width} text-center`}
            />
          </Fragment>
        );
      })}
    </div>
  );
}
