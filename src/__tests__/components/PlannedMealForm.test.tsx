import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import PlannedMealForm from '@/components/PlannedMealForm';

jest.mock('swr');
jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('@/lib/houses', () => ({
  useActiveHouse: () => ({ id: 'house-1', name: 'Home', role: 'OWNER' }),
}));

const useSWR = require('swr').default as jest.Mock;
const useRouter = require('next/router').useRouter as jest.Mock;

function resolveKey(key: unknown): unknown {
  return typeof key === 'function' ? (key as () => unknown)() : key;
}

function wrap<T>(data: T) {
  return { data, status: 200, headers: new Headers() };
}

const grams: Measure = { measureId: 'g', singular: 'gram', plural: 'grams', short: 'g' };

const pantryItemA: PantryItem = {
  uuid: 'item-a',
  name: 'Bread',
  measure: 'g',
  amount: 500,
  remaining: 500,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const pantryItemB: PantryItem = {
  uuid: 'item-b',
  name: 'Bread (2nd loaf)',
  measure: 'g',
  amount: 300,
  remaining: 300,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

function suggestion(item: PantryItem, available: number) {
  return { ...item, available };
}

function mockSWR({ suggestions }: { suggestions?: Array<ReturnType<typeof suggestion>> }) {
  useSWR.mockImplementation((key: unknown) => {
    const resolved = resolveKey(key);
    const url = Array.isArray(resolved) ? resolved[0] : resolved;
    if (url === '/api/recipes') return { data: wrap([]) };
    if (url === '/api/pantry') return { data: wrap([pantryItemA, pantryItemB]) };
    if (url === '/api/measures') return { data: [grams] };
    if (url === '/api/planned-meals/suggestions') return { data: wrap(suggestions ?? []) };
    return { data: undefined };
  });
}

async function settleDebounce() {
  await act(async () => {
    jest.advanceTimersByTime(400);
    await Promise.resolve();
  });
}

describe('PlannedMealForm', () => {
  beforeEach(() => {
    useRouter.mockReturnValue({ push: jest.fn(), back: jest.fn() });
    jest.useFakeTimers({ advanceTimers: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ranks suggested pantry items first in the stock picker', async () => {
    mockSWR({ suggestions: [suggestion(pantryItemB, 300)] });
    render(<PlannedMealForm submitLabel="Plan meal" onSubmit={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('New ingredient name'), { target: { value: 'Bread' } });
    fireEvent.change(screen.getByLabelText('New ingredient amount'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await settleDebounce();

    const select = screen.getByLabelText('From stock');
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.getAttribute('value'));
    expect(options.slice(0, 2)).toEqual(['', 'item-b']);
  });

  it('auto-fills a single allocation when one suggestion fully covers the amount', async () => {
    mockSWR({ suggestions: [suggestion(pantryItemA, 500)] });
    render(<PlannedMealForm submitLabel="Plan meal" onSubmit={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('New ingredient name'), { target: { value: 'Bread' } });
    fireEvent.change(screen.getByLabelText('New ingredient amount'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await settleDebounce();

    await waitFor(() => expect(screen.getByLabelText('From stock')).toHaveValue('item-a'));
  });

  it('combines two partial-availability suggestions to cover the row', async () => {
    mockSWR({ suggestions: [suggestion(pantryItemA, 60), suggestion(pantryItemB, 40)] });
    render(<PlannedMealForm submitLabel="Plan meal" onSubmit={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('New ingredient name'), { target: { value: 'Bread' } });
    fireEvent.change(screen.getByLabelText('New ingredient amount'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await settleDebounce();

    await waitFor(() => expect(screen.getAllByLabelText('From stock')).toHaveLength(2));
    const values = screen.getAllByLabelText('From stock').map((el) => (el as HTMLSelectElement).value);
    expect(values).toEqual(['item-a', 'item-b']);
  });

  it('never auto-picks an item with nothing available', async () => {
    mockSWR({ suggestions: [suggestion(pantryItemA, 0)] });
    render(<PlannedMealForm submitLabel="Plan meal" onSubmit={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('New ingredient name'), { target: { value: 'Bread' } });
    fireEvent.change(screen.getByLabelText('New ingredient amount'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await settleDebounce();

    expect(screen.queryByLabelText('From stock')).not.toBeInTheDocument();
  });

  it('does not reinstate an allocation the user explicitly cleared', async () => {
    mockSWR({ suggestions: [suggestion(pantryItemA, 500)] });
    render(<PlannedMealForm submitLabel="Plan meal" onSubmit={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('New ingredient name'), { target: { value: 'Bread' } });
    fireEvent.change(screen.getByLabelText('New ingredient amount'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await settleDebounce();
    await waitFor(() => expect(screen.getByLabelText('From stock')).toHaveValue('item-a'));

    fireEvent.click(screen.getByLabelText('Remove allocation'));
    expect(screen.queryByLabelText('From stock')).not.toBeInTheDocument();

    await settleDebounce();
    expect(screen.queryByLabelText('From stock')).not.toBeInTheDocument();
  });

  it('supports adding a second allocation line manually', async () => {
    mockSWR({ suggestions: [] });
    render(<PlannedMealForm submitLabel="Plan meal" onSubmit={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('New ingredient name'), { target: { value: 'Bread' } });
    fireEvent.change(screen.getByLabelText('New ingredient amount'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await settleDebounce();

    fireEvent.click(screen.getByRole('button', { name: '+ add another from stock' }));
    fireEvent.click(screen.getByRole('button', { name: '+ add another from stock' }));

    expect(screen.getAllByLabelText('From stock')).toHaveLength(2);
  });
});
