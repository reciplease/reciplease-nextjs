import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import RecipeTableEditor from '@/components/RecipeTableEditor';

const row = (text: string): TableCell => ({ text, inputs: [] });
const step = (text: string, ...inputs: TableCell[]): TableCell => ({ text, inputs });

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
});
