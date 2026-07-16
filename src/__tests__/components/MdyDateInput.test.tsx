import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import MdyDateInput from '@/components/MdyDateInput';

function ControlledDateInput({ onChange }: { onChange: (isoDate: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <MdyDateInput
      idPrefix="test"
      value={value}
      onChange={(isoDate) => {
        setValue(isoDate);
        onChange(isoDate);
      }}
      inputClassName=""
    />
  );
}

describe('MdyDateInput', () => {
  function setup() {
    const onChange = jest.fn();
    render(<ControlledDateInput onChange={onChange} />);
    return {
      onChange,
      day: screen.getByLabelText('Day'),
      month: screen.getByLabelText('Month'),
      year: screen.getByLabelText('Year'),
    };
  }

  it('emits an ISO date once all segments are complete', () => {
    const { onChange, day, month, year } = setup();

    fireEvent.change(day, { target: { value: '05' } });
    fireEvent.change(month, { target: { value: '02' } });
    fireEvent.change(year, { target: { value: '2027' } });

    expect(onChange).toHaveBeenLastCalledWith('2027-02-05');
  });

  it.each([
    ['FEB', '2027-02-05'],
    ['feb', '2027-02-05'],
    ['Feb', '2027-02-05'],
    ['february', '2027-02-05'],
    ['2', '2027-02-05'],
    ['dec', '2027-12-05'],
  ])('accepts free-text month %s and converts it to ISO', (monthText, expected) => {
    const { onChange, day, month, year } = setup();

    fireEvent.change(day, { target: { value: '05' } });
    fireEvent.change(year, { target: { value: '2027' } });
    fireEvent.change(month, { target: { value: monthText } });

    expect(onChange).toHaveBeenLastCalledWith(expected);
  });

  it('emits empty string while the month is not yet a resolvable month', () => {
    const { onChange, day, month, year } = setup();

    fireEvent.change(day, { target: { value: '05' } });
    fireEvent.change(year, { target: { value: '2027' } });
    fireEvent.change(month, { target: { value: 'xyz' } });

    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('keeps the typed month text visible rather than rewriting it', () => {
    const { month } = setup();

    fireEvent.change(month, { target: { value: 'FEB' } });

    expect((month as HTMLInputElement).value).toBe('FEB');
  });

  it('survives typing a month name letter by letter with day and year already set', () => {
    const { onChange, day, month, year } = setup();

    fireEvent.change(day, { target: { value: '05' } });
    fireEvent.change(year, { target: { value: '2027' } });
    const word = 'february';
    for (let i = 1; i <= word.length; i++) {
      fireEvent.change(month, { target: { value: word.slice(0, i) } });
      // The controlled parent echoing the emitted ISO date back must never
      // rewrite the month mid-typing ("feb" → "02" under the cursor).
      expect((month as HTMLInputElement).value).toBe(word.slice(0, i));
    }

    expect((day as HTMLInputElement).value).toBe('05');
    expect((year as HTMLInputElement).value).toBe('2027');
    expect(onChange).toHaveBeenLastCalledWith('2027-02-05');
  });

  it('keeps month and year when a day digit is deleted after a complete date', () => {
    const { day, month, year } = setup();

    fireEvent.change(day, { target: { value: '05' } });
    fireEvent.change(month, { target: { value: '02' } });
    fireEvent.change(year, { target: { value: '2027' } });
    fireEvent.change(day, { target: { value: '' } });

    expect((month as HTMLInputElement).value).toBe('02');
    expect((year as HTMLInputElement).value).toBe('2027');
  });

  it('emits with a single-digit day, zero-padded', () => {
    const { onChange, day, month, year } = setup();

    fireEvent.change(day, { target: { value: '5' } });
    fireEvent.change(month, { target: { value: '06' } });
    fireEvent.change(year, { target: { value: '2027' } });

    expect(onChange).toHaveBeenLastCalledWith('2027-06-05');
  });

  it('moves focus to the month after two day digits, and to the year after two month digits', () => {
    const { day, month, year } = setup();

    fireEvent.change(day, { target: { value: '05' } });
    expect(month).toHaveFocus();

    fireEvent.change(month, { target: { value: '02' } });
    expect(year).toHaveFocus();
  });

  it('does not steal focus while a month name is being typed', () => {
    const { month, year } = setup();

    (month as HTMLInputElement).focus();
    fireEvent.change(month, { target: { value: 'fe' } });

    expect(year).not.toHaveFocus();
  });

  it('shows a numeric month when the parent supplies an ISO value', () => {
    render(
      <MdyDateInput idPrefix="test" value="2027-02-05" onChange={jest.fn()} inputClassName="" />,
    );

    expect((screen.getByLabelText('Month') as HTMLInputElement).value).toBe('02');
    expect((screen.getByLabelText('Day') as HTMLInputElement).value).toBe('05');
    expect((screen.getByLabelText('Year') as HTMLInputElement).value).toBe('2027');
  });
});
