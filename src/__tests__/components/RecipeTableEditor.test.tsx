import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import RecipeTableEditor from '@/components/RecipeTableEditor';

const row = (text: string): TableCell => ({ text, inputs: [], handsOff: false });
const step = (text: string, ...inputs: TableCell[]): TableCell => ({ text, inputs, handsOff: false });
const withDuration = (cell: TableCell, minMinutes: number, maxMinutes: number): TableCell => ({
  ...cell,
  duration: { minMinutes, maxMinutes },
});

let latest: TableCell[] = [];

function Harness({ initial, ingredients = [] }: { initial: TableCell[]; ingredients?: string[] }) {
  const [cells, setCells] = useState(initial);
  const onChange = (next: TableCell[]) => {
    latest = next;
    setCells(next);
  };
  return <RecipeTableEditor cells={cells} ingredients={ingredients} onChange={onChange} />;
}

const cell = (name: string) => screen.getByRole('button', { name });
const stepText = () => screen.getByLabelText('Step text');

describe('RecipeTableEditor', () => {
  beforeEach(() => {
    latest = [];
  });

  it('adds a row', () => {
    render(<Harness initial={[row('bread')]} />);

    fireEvent.change(screen.getByLabelText('New row'), { target: { value: 'butter' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add row' }));

    expect(latest).toEqual([row('bread'), row('butter')]);
    expect(screen.getByLabelText('New row')).toHaveValue('');
  });

  it('adds ingredients as rows, skipping ones that are already rows', () => {
    render(<Harness initial={[row('bread')]} ingredients={['bread', 'butter']} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add ingredients as rows' }));

    expect(latest).toEqual([row('bread'), row('butter')]);
  });

  it('combines the selected rows into a step', () => {
    render(<Harness initial={[row('bread'), row('jam'), row('butter')]} />);

    fireEvent.click(cell('butter'));
    fireEvent.click(cell('bread'));
    fireEvent.change(stepText(), { target: { value: 'spread' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add step' }));

    expect(latest).toEqual([step('spread', row('bread'), row('butter')), row('jam')]);
    expect(cell('spread')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByLabelText('Step text')).not.toBeInTheDocument();
  });

  it('only combines cells that are not already part of a later step', () => {
    render(<Harness initial={[step('toast', row('bread')), row('butter')]} />);

    fireEvent.click(cell('bread'));
    fireEvent.click(cell('butter'));
    fireEvent.change(stepText(), { target: { value: 'spread' } });

    expect(screen.getByRole('button', { name: 'Add step' })).toBeDisabled();
  });

  it('renames the selected cell, starting from its current text', () => {
    render(<Harness initial={[step('toast', row('bread'))]} />);

    fireEvent.click(cell('toast'));
    expect(stepText()).toHaveValue('toast');
    fireEvent.change(stepText(), { target: { value: 'grill' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    expect(latest).toEqual([step('grill', row('bread'))]);
  });

  it('removes a selected step, putting its inputs back', () => {
    render(<Harness initial={[step('toast', row('bread'))]} />);

    fireEvent.click(cell('toast'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(latest).toEqual([row('bread')]);
  });

  it('cannot remove a row that a step still uses', () => {
    render(<Harness initial={[step('toast', row('bread'))]} />);

    fireEvent.click(cell('bread'));

    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });

  it('hides the step tools until something is selected', () => {
    render(<Harness initial={[row('bread')]} />);

    expect(screen.queryByLabelText('Step text')).not.toBeInTheDocument();
  });

  describe('timing', () => {
    const minField = () => screen.getByLabelText('Min minutes');
    const maxField = () => screen.getByLabelText('Max minutes');
    const handsOff = () => screen.getByRole('checkbox', { name: 'Hands-off' });

    it('shows the timing fields only while exactly one cell is selected', () => {
      render(<Harness initial={[row('bread'), row('butter')]} />);
      expect(screen.queryByLabelText('Min minutes')).not.toBeInTheDocument();

      fireEvent.click(cell('bread'));
      expect(minField()).toBeInTheDocument();
      expect(maxField()).toBeInTheDocument();
      expect(handsOff()).not.toBeChecked();

      fireEvent.click(cell('butter'));
      expect(screen.queryByLabelText('Min minutes')).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'Hands-off' })).not.toBeInTheDocument();
    });

    it('sets a duration range on the selected cell and keeps it selected', () => {
      render(<Harness initial={[row('bread')]} />);

      fireEvent.click(cell('bread'));
      fireEvent.change(minField(), { target: { value: '15' } });
      fireEvent.change(maxField(), { target: { value: '20' } });

      expect(latest).toEqual([withDuration(row('bread'), 15, 20)]);
      expect(stepText()).toBeInTheDocument();
    });

    it('sets both ends equal when only min is filled', () => {
      render(<Harness initial={[row('bread')]} />);

      fireEvent.click(cell('bread'));
      fireEvent.change(minField(), { target: { value: '15' } });

      expect(latest).toEqual([withDuration(row('bread'), 15, 15)]);
    });

    it('sets both ends equal when only max is filled', () => {
      render(<Harness initial={[row('bread')]} />);

      fireEvent.click(cell('bread'));
      fireEvent.change(maxField(), { target: { value: '20' } });

      expect(latest).toEqual([withDuration(row('bread'), 20, 20)]);
    });

    it('shows the existing duration when the cell is selected', () => {
      render(<Harness initial={[withDuration(row('bread'), 15, 20), withDuration(row('butter'), 10, 10)]} />);

      fireEvent.click(cell('bread'));
      expect(minField()).toHaveValue(15);
      expect(maxField()).toHaveValue(20);

      fireEvent.click(cell('bread'));
      fireEvent.click(cell('butter'));
      expect(minField()).toHaveValue(10);
      expect(maxField()).toHaveValue(null);
    });

    it('clears the duration when both fields are emptied', () => {
      render(<Harness initial={[withDuration(row('bread'), 15, 20)]} />);

      fireEvent.click(cell('bread'));
      fireEvent.change(minField(), { target: { value: '' } });
      expect(latest).toEqual([withDuration(row('bread'), 20, 20)]);
      fireEvent.change(maxField(), { target: { value: '' } });

      expect(latest).toEqual([row('bread')]);
      expect(latest[0].duration).toBeUndefined();
    });

    it('rejects a max below the min with a message and does not apply it', () => {
      render(<Harness initial={[row('bread')]} />);

      fireEvent.click(cell('bread'));
      fireEvent.change(minField(), { target: { value: '15' } });
      fireEvent.change(maxField(), { target: { value: '10' } });

      expect(screen.getByRole('alert')).toHaveTextContent('max cannot be less than min');
      expect(latest).toEqual([withDuration(row('bread'), 15, 15)]);
    });

    it('clears the message once the range is valid again', () => {
      render(<Harness initial={[row('bread')]} />);

      fireEvent.click(cell('bread'));
      fireEvent.change(minField(), { target: { value: '15' } });
      fireEvent.change(maxField(), { target: { value: '10' } });
      fireEvent.change(maxField(), { target: { value: '25' } });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(latest).toEqual([withDuration(row('bread'), 15, 25)]);
    });

    it('rejects negative and fractional minutes', () => {
      render(<Harness initial={[row('bread')]} />);

      fireEvent.click(cell('bread'));
      fireEvent.change(minField(), { target: { value: '-5' } });
      expect(screen.getByRole('alert')).toBeInTheDocument();
      fireEvent.change(minField(), { target: { value: '2.5' } });

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(latest).toEqual([]);
    });

    it('toggles hands-off and keeps the duration', () => {
      render(<Harness initial={[withDuration(row('bread'), 15, 20)]} />);

      fireEvent.click(cell('bread'));
      fireEvent.click(handsOff());

      expect(latest).toEqual([{ ...withDuration(row('bread'), 15, 20), handsOff: true }]);
      expect(handsOff()).toBeChecked();

      fireEvent.click(handsOff());
      expect(latest).toEqual([withDuration(row('bread'), 15, 20)]);
    });

    it('keeps the duration and hands-off when the step is renamed', () => {
      const bake = { ...withDuration(step('bake', row('dough')), 20, 25), handsOff: true };
      render(<Harness initial={[bake]} />);

      fireEvent.click(cell('bake'));
      fireEvent.change(stepText(), { target: { value: 'roast' } });
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

      expect(latest).toEqual([{ ...bake, text: 'roast' }]);
    });
  });
});
