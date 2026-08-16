import { render, screen, fireEvent, within } from '@testing-library/react';
import WeekCalendar from '@/components/planner/WeekCalendar';

describe('WeekCalendar', () => {
  it('shows the month containing the selected week', () => {
    render(<WeekCalendar selectedMonday="2026-06-01" onSelect={jest.fn()} />);
    expect(screen.getByText('June 2026')).toBeInTheDocument();
  });

  it('marks every day in the selected week as pressed', () => {
    render(<WeekCalendar selectedMonday="2026-06-01" onSelect={jest.fn()} />);
    // Mon 1 Jun - Sun 7 Jun
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(7);
  });

  it("selecting any day in a week reports that week's Monday", () => {
    const onSelect = jest.fn();
    render(<WeekCalendar selectedMonday="2026-06-01" onSelect={onSelect} />);

    // Thursday 18 June is in the week starting Monday 15 June.
    fireEvent.click(screen.getByText('18'));

    expect(onSelect).toHaveBeenCalledWith('2026-06-15');
  });

  it('navigates to the previous and next month', () => {
    render(<WeekCalendar selectedMonday="2026-06-01" onSelect={jest.fn()} />);

    fireEvent.click(screen.getByLabelText('Next month'));
    expect(screen.getByText('July 2026')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Previous month'));
    fireEvent.click(screen.getByLabelText('Previous month'));
    expect(screen.getByText('May 2026')).toBeInTheDocument();
  });

  it('selecting a day from an adjacent month jumps the view to that month', () => {
    const onSelect = jest.fn();
    render(<WeekCalendar selectedMonday="2026-06-01" onSelect={onSelect} />);

    // June 2026 ends on a Tuesday, so the last row (week of Mon 29 Jun) spans
    // into July — 1 Jul renders as a trailing, dimmed day in June's grid.
    const trailingJuly1 = screen
      .getAllByLabelText('Select week of 2026-06-29')
      .find((btn) => btn.textContent === '1')!;

    fireEvent.click(trailingJuly1);

    expect(onSelect).toHaveBeenCalledWith('2026-06-29');
    expect(screen.getByText('July 2026')).toBeInTheDocument();
  });

  it('marks days that have a planned meal with a dot, regardless of which week is selected', () => {
    render(
      <WeekCalendar
        selectedMonday="2026-06-01"
        onSelect={jest.fn()}
        // One planned day in the selected week (5 Jun) and one in a
        // different, unselected week (18 Jun) — both should get a dot.
        plannedDates={new Set(['2026-06-05', '2026-06-18'])}
      />,
    );

    const weekOne = screen.getAllByLabelText('Select week of 2026-06-01');
    const fifth = weekOne.find((btn) => btn.textContent === '5')!;
    const fourth = weekOne.find((btn) => btn.textContent === '4')!;
    const eighteenth = screen
      .getAllByLabelText('Select week of 2026-06-15')
      .find((btn) => btn.textContent === '18')!;

    expect(within(fifth).queryByTestId('planned-meal-dot')).toBeInTheDocument();
    expect(within(fourth).queryByTestId('planned-meal-dot')).not.toBeInTheDocument();
    expect(within(eighteenth).queryByTestId('planned-meal-dot')).toBeInTheDocument();
  });

  it('shades every week except the currently selected one', () => {
    render(<WeekCalendar selectedMonday="2026-06-15" onSelect={jest.fn()} />);

    const selectedWeekDay = screen.getAllByLabelText('Select week of 2026-06-15')[0];
    const otherWeekDay = screen.getAllByLabelText('Select week of 2026-06-01')[0];

    expect(selectedWeekDay.parentElement?.className).not.toEqual(expect.stringContaining('bg-highlight/20'));
    expect(otherWeekDay.parentElement?.className).toEqual(expect.stringContaining('bg-highlight/20'));
  });

  it('reports the visible grid range on mount and after month navigation', () => {
    const onVisibleRangeChange = jest.fn();
    render(
      <WeekCalendar selectedMonday="2026-06-01" onSelect={jest.fn()} onVisibleRangeChange={onVisibleRangeChange} />,
    );

    // June 2026's grid runs Mon 1 Jun (no leading days) to Sun 5 Jul (trailing
    // days needed to fill the last row).
    expect(onVisibleRangeChange).toHaveBeenLastCalledWith('2026-06-01', '2026-07-05');

    fireEvent.click(screen.getByLabelText('Next month'));

    expect(onVisibleRangeChange).toHaveBeenLastCalledWith('2026-06-29', '2026-08-02');
  });
});
