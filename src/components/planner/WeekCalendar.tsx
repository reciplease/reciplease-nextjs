import { useEffect, useState } from 'react';
import { firstOfMonth, mondayOf, toIsoDate, weeksInMonth } from '@/lib/week';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function WeekCalendar({
  selectedMonday,
  onSelect,
  plannedDates,
  onVisibleRangeChange,
}: {
  selectedMonday: string;
  onSelect: (mondayIso: string) => void;
  // ISO dates (yyyy-mm-dd) that have at least one planned meal — days in this
  // set get an outline so the month view shows where meals already exist.
  plannedDates?: Set<string>;
  // Fired on mount and whenever month navigation changes the visible grid, so
  // a caller can fetch planned meals for exactly the days currently on screen.
  onVisibleRangeChange?: (startIso: string, endIso: string) => void;
}) {
  const [viewMonth, setViewMonth] = useState(() => firstOfMonth(mondayOf(new Date(`${selectedMonday}T00:00:00`))));

  const today = toIsoDate(new Date());
  const weeks = weeksInMonth(viewMonth);

  useEffect(() => {
    if (!onVisibleRangeChange) return;
    const lastWeek = weeks[weeks.length - 1];
    onVisibleRangeChange(toIsoDate(weeks[0][0]), toIsoDate(lastWeek[6]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMonth]);

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
              // bg-highlight/20 (not a light literal like #eef5ff) so this reads
              // correctly against the app's dark theme, which otherwise leaves
              // day numbers in their default light-on-dark colour.
              className={`grid grid-cols-7 gap-1 rounded ${isSelectedWeek ? 'bg-highlight/20' : ''}`}
            >
              {week.map((day) => {
                const iso = toIsoDate(day);
                const isCurrentMonth = day.getMonth() === viewMonth.getMonth();
                const isToday = iso === today;
                const isPlanned = plannedDates?.has(iso) ?? false;
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
                    // Planned days are filled with bg-recipe-highlight (not
                    // bg-highlight, which the .planner-theme wrapper recolours to
                    // blue) so a planned day reads as unmistakably "has a recipe"
                    // against the section's own blue accent.
                    className={`p-1.5 rounded text-sm ${isPlanned ? 'bg-recipe-highlight text-white' : isCurrentMonth ? '' : 'text-[#bbb]'} ${isToday ? 'font-semibold underline' : ''}`}
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
