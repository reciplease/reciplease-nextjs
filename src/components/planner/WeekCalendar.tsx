import { useState } from 'react';
import { addDays, mondayOf, toIsoDate } from '@/lib/week';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function firstOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

// Weeks (Monday-first) spanning the calendar month that contains `monthDate`,
// including the leading/trailing days of neighbouring months needed to fill
// each row.
function weeksInMonth(monthDate: Date): Date[][] {
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

export default function WeekCalendar({
  selectedMonday,
  onSelect,
}: {
  selectedMonday: string;
  onSelect: (mondayIso: string) => void;
}) {
  const [viewMonth, setViewMonth] = useState(() => firstOfMonth(mondayOf(new Date(`${selectedMonday}T00:00:00`))));

  const today = toIsoDate(new Date());
  const weeks = weeksInMonth(viewMonth);

  return (
    <div className="border border-[#ccc] rounded p-3 grid gap-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
        >
          ‹
        </button>
        <span className="font-medium">
          {viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-[#666]">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="grid gap-1">
        {weeks.map((week) => {
          const weekMonday = toIsoDate(week[0]);
          const isSelectedWeek = weekMonday === selectedMonday;
          return (
            <div
              key={weekMonday}
              className={`grid grid-cols-7 gap-1 rounded ${isSelectedWeek ? 'bg-[#eef5ff]' : ''}`}
            >
              {week.map((day) => {
                const iso = toIsoDate(day);
                const isCurrentMonth = day.getMonth() === viewMonth.getMonth();
                const isToday = iso === today;
                return (
                  <button
                    key={iso}
                    type="button"
                    aria-label={`Select week of ${weekMonday}`}
                    aria-pressed={isSelectedWeek}
                    onClick={() => {
                      onSelect(weekMonday);
                      if (!isCurrentMonth) setViewMonth(firstOfMonth(day));
                    }}
                    className={`p-1.5 rounded text-sm ${isCurrentMonth ? '' : 'text-[#bbb]'} ${isToday ? 'font-semibold underline' : ''}`}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
