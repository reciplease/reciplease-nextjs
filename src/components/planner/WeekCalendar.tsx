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
  // set get a dot under the date so the month view shows where meals already
  // exist, independent of which week is currently selected.
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

      <button
        type="button"
        className="justify-self-center text-sm px-3 py-1"
        onClick={() => {
          const now = new Date();
          setViewMonth(firstOfMonth(now));
          onSelect(toIsoDate(mondayOf(now)));
        }}
      >
        Today
      </button>

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
              // The selected week gets a light tint of the section's own accent
              // colour (bg-highlight/20 — planner blue here, via .planner-theme)
              // so it reads as "the one you're looking at". Every other week
              // gets a much subtler neutral tint (bg-white/5, not bg-highlight)
              // — colouring the majority of the grid drew the eye to the wrong
              // place and read like the *other* weeks were the highlighted ones.
              className={`grid grid-cols-7 gap-1 rounded ${isSelectedWeek ? 'bg-highlight/20' : 'bg-white/5'}`}
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
                    className={`flex flex-col items-center gap-0.5 p-1.5 rounded text-sm ${isCurrentMonth ? '' : 'text-[#bbb]'} ${isToday ? 'font-semibold underline' : ''}`}
                  >
                    <span>{day.getDate()}</span>
                    {/* Reserve the dot's space on every day (not just planned ones) so
                        planned/unplanned days don't shift height against each other. */}
                    <span
                      aria-hidden="true"
                      data-testid={isPlanned ? 'planned-meal-dot' : undefined}
                      className={`h-1 w-1 rounded-full ${isPlanned ? 'bg-recipe-highlight' : 'bg-transparent'}`}
                    />
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
