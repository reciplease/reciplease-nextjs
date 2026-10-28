import { act, fireEvent, render, screen, within } from '@testing-library/react';
import RecipeTable from '@/components/RecipeTable';

const row = (text: string): TableCell => ({ text, inputs: [], handsOff: false });
const step = (text: string, ...inputs: TableCell[]): TableCell => ({ text, inputs, handsOff: false });
const timed = (
  text: string,
  minMinutes: number,
  maxMinutes: number,
  inputs: TableCell[] = [],
  handsOff = false,
): TableCell => ({ text, inputs, handsOff, duration: { minMinutes, maxMinutes } });

const toast = [step('spread', step('toast', row('bread')), row('butter'))];
const pie = [
  timed(
    'bake',
    25,
    25,
    [step('mash', timed('boil', 15, 20, [row('potato')], true)), step('stir', timed('cook', 10, 10, [row('mince')]))],
    true,
  ),
];
const folding = [step('fold', step('mix', step('cream', row('butter'))), row('chips'))];

const defaultTextWidth = 50;
let tableWidth = 300;
let textWidths: Record<string, number> = {};

const elementOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
const tableOffsetWidth = Object.getOwnPropertyDescriptor(HTMLTableElement.prototype, 'offsetWidth');
const spanOffsetWidth = Object.getOwnPropertyDescriptor(HTMLSpanElement.prototype, 'offsetWidth');

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      return 150;
    },
  });
  Object.defineProperty(HTMLTableElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      return tableWidth;
    },
  });
  Object.defineProperty(HTMLSpanElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      return textWidths[this.textContent] ?? defaultTextWidth;
    },
  });
});

afterEach(() => {
  tableWidth = 300;
  textWidths = {};
});

afterAll(() => {
  restoreOffsetWidth(HTMLElement.prototype, elementOffsetWidth);
  restoreOffsetWidth(HTMLTableElement.prototype, tableOffsetWidth);
  restoreOffsetWidth(HTMLSpanElement.prototype, spanOffsetWidth);
});

function restoreOffsetWidth(prototype: object, descriptor?: PropertyDescriptor) {
  if (descriptor) Object.defineProperty(prototype, 'offsetWidth', descriptor);
  else Reflect.deleteProperty(prototype, 'offsetWidth');
}

function renderTable(cells: TableCell[] = toast) {
  render(<RecipeTable cells={cells} />);
  const scroller = screen.getByRole('region', { name: 'Method' });
  scroller.scrollTo = jest.fn();
  return scroller;
}

const cell = (name: string) => screen.getByRole('button', { name });

describe('RecipeTable', () => {
  it('renders each cell spanning the rows it combines and reaching its next step', () => {
    renderTable();

    expect(cell('spread').closest('td')).toHaveAttribute('rowspan', '2');
    expect(cell('butter').closest('td')).toHaveAttribute('colspan', '2');
    expect(cell('bread').closest('td')).toHaveAttribute('colspan', '1');
  });

  it('wraps cell text at 40 characters wide instead of stretching across a long cell', () => {
    renderTable();

    expect(screen.getByText('butter')).toHaveClass('max-w-[40ch]');
  });

  it('marks a cell and everything feeding into it as done', () => {
    renderTable();

    fireEvent.click(cell('toast'));

    expect(cell('toast')).toHaveAttribute('aria-pressed', 'true');
    expect(cell('bread')).toHaveAttribute('aria-pressed', 'true');
    expect(cell('butter')).toHaveAttribute('aria-pressed', 'false');
    expect(cell('spread')).toHaveAttribute('aria-pressed', 'false');
  });

  it('un-marks the clicked cell and its ancestors', () => {
    renderTable();

    fireEvent.click(cell('spread'));
    fireEvent.click(cell('bread'));

    expect(cell('bread')).toHaveAttribute('aria-pressed', 'false');
    expect(cell('toast')).toHaveAttribute('aria-pressed', 'false');
    expect(cell('spread')).toHaveAttribute('aria-pressed', 'false');
    expect(cell('butter')).toHaveAttribute('aria-pressed', 'true');
  });

  it('un-marks the clicked cell but leaves its inputs ticked', () => {
    renderTable();

    fireEvent.click(cell('toast'));
    fireEvent.click(cell('toast'));

    expect(cell('toast')).toHaveAttribute('aria-pressed', 'false');
    expect(cell('bread')).toHaveAttribute('aria-pressed', 'true');
  });

  it('styles done cells with text dark enough to read', () => {
    renderTable();

    fireEvent.click(cell('bread'));

    expect(cell('bread').closest('td')).toHaveClass('text-[#555]');
  });

  it('does not scroll while an unfinished cell still occupies the first column', () => {
    const scroller = renderTable();

    fireEvent.click(cell('bread'));

    expect(scroller.scrollTo).toHaveBeenLastCalledWith({ left: 0 });
  });

  it('scrolls past a column only once every cell starting in it is done', () => {
    const scroller = renderTable();

    fireEvent.click(cell('bread'));
    fireEvent.click(cell('butter'));

    expect(scroller.scrollTo).toHaveBeenLastCalledWith({ left: 100 });
  });

  it('does not scroll when un-marking brings an unfinished cell back to the first column', () => {
    const scroller = renderTable();

    fireEvent.click(cell('bread'));
    fireEvent.click(cell('butter'));
    fireEvent.click(cell('butter'));

    expect(scroller.scrollTo).toHaveBeenLastCalledWith({ left: 0 });
  });

  it('does not scroll when everything is done', () => {
    const scroller = renderTable();

    fireEvent.click(cell('spread'));

    expect(scroller.scrollTo).not.toHaveBeenCalled();
  });

  describe('timings', () => {
    const startTimer = () => screen.getByRole('button', { name: 'Start recipe timer' });
    const named = (prefix: string) => screen.getByRole('button', { name: new RegExp(`^${prefix}`) });

    it('shows nothing extra when no cell has a duration', () => {
      renderTable();

      expect(screen.queryByText(/Total/)).not.toBeInTheDocument();
      expect(screen.queryByText(/start \d+ min before end/)).not.toBeInTheDocument();
      expect(screen.queryByText(/critical path/)).not.toBeInTheDocument();
    });

    it('shows the total time above the table', () => {
      renderTable(pie);

      expect(screen.getByText('Total 45 min')).toBeInTheDocument();
    });

    it('shows each duration under its cell text, as a range or a single time', () => {
      renderTable(pie);

      expect(within(named('boil')).getByText(/^15–20 min/)).toBeInTheDocument();
      expect(within(named('cook')).getByText(/^10 min/)).toBeInTheDocument();
      expect(within(named('potato')).queryByText(/min/)).not.toBeInTheDocument();
    });

    it('marks hands-off cells with the word hands-off', () => {
      renderTable(pie);

      expect(within(named('boil')).getByText(/hands-off/)).toBeInTheDocument();
      expect(within(named('cook')).queryByText(/hands-off/)).not.toBeInTheDocument();
    });

    it('shows no start labels until the recipe timer is running', () => {
      renderTable(pie);

      expect(screen.queryByText(/start/)).not.toBeInTheDocument();
    });

    describe('recipe timer', () => {
      const ding = jest.fn();
      beforeEach(() => {
        jest.useFakeTimers();
        ding.mockClear();
        const oscillator = { type: '', frequency: {}, connect: () => ({ connect: jest.fn() }), start: ding, stop: jest.fn() };
        const param = { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() };
        window.AudioContext = jest.fn(() => ({
          currentTime: 0,
          destination: {},
          createOscillator: () => oscillator,
          createGain: () => ({ gain: param }),
        })) as unknown as typeof AudioContext;
      });
      afterEach(() => {
        jest.useRealTimers();
        Reflect.deleteProperty(window, 'AudioContext');
      });
      const tick = (seconds: number) => act(() => void jest.advanceTimersByTime(seconds * 1000));

      it('counts the whole recipe down from its total', () => {
        renderTable(pie);
        fireEvent.click(startTimer());
        expect(screen.getByText('Time left 45 min')).toBeInTheDocument();

        tick(65);

        expect(screen.getByText('Time left 45 min')).toBeInTheDocument();
      });

      it('counts each step down to when it must start, then says start now', () => {
        renderTable(pie);
        fireEvent.click(startTimer());

        expect(within(named('cook')).getByText('start in 10 min')).toBeInTheDocument();
        expect(within(named('boil')).getByText('start now')).toBeInTheDocument();

        tick(10 * 60);

        expect(within(named('cook')).getByText('start now')).toBeInTheDocument();
      });

      it('dings when a step reaches its start time, but not for ticked steps', () => {
        renderTable(pie);
        fireEvent.click(startTimer());
        tick(10 * 60 - 1);
        expect(ding).not.toHaveBeenCalled();

        tick(1);
        expect(ding).toHaveBeenCalledTimes(1);
      });

      it('does not ding for a step that is already ticked', () => {
        renderTable(pie);
        fireEvent.click(startTimer());
        fireEvent.click(named('cook'));
        ding.mockClear();

        tick(10 * 60);

        expect(ding).not.toHaveBeenCalled();
      });

      it('jumps forward to when a ticked step finishes, so a refresh can be caught up by re-ticking', () => {
        renderTable(pie);
        fireEvent.click(startTimer());

        fireEvent.click(named('mash'));

        expect(screen.getByText('Time left 25 min')).toBeInTheDocument();
        tick(1);
        expect(screen.getByText('Time left 25 min')).toBeInTheDocument();
      });

      it('never winds the timer back when ticking an earlier step', () => {
        renderTable(pie);
        fireEvent.click(startTimer());
        tick(30 * 60);

        fireEvent.click(named('boil'));

        expect(screen.getByText('Time left 15 min')).toBeInTheDocument();
      });

      it('leaves the timer alone when a step is un-ticked', () => {
        renderTable(pie);
        fireEvent.click(startTimer());
        fireEvent.click(named('mash'));
        fireEvent.click(named('mash'));

        expect(screen.getByText('Time left 25 min')).toBeInTheDocument();
      });

      it('stops the timer and returns to the total', () => {
        renderTable(pie);
        fireEvent.click(startTimer());

        fireEvent.click(screen.getByRole('button', { name: 'Stop recipe timer' }));

        expect(screen.getByText('Total 45 min')).toBeInTheDocument();
        expect(screen.queryByText(/start/)).not.toBeInTheDocument();
      });
    });

    it('gives plain rows no start label', () => {
      renderTable(pie);
      fireEvent.click(startTimer());

      expect(within(named('mince')).queryByText(/start/)).not.toBeInTheDocument();
    });

    it('drops the start label once a cell is ticked', () => {
      renderTable(pie);
      fireEvent.click(startTimer());

      fireEvent.click(named('cook'));

      expect(within(named('cook')).queryByText(/start/)).not.toBeInTheDocument();
    });

    it('keeps the duration visible on ticked cells', () => {
      renderTable(pie);

      fireEvent.click(named('cook'));

      expect(within(named('cook')).getByText(/^10 min/)).toBeInTheDocument();
    });

    it('marks steps on the critical path with a thick border, a title and a screen reader label', () => {
      renderTable(pie);

      ['bake', 'mash', 'boil'].forEach((name) => {
        expect(named(name)).toHaveAttribute('title', 'on the critical path');
        expect(named(name)).toHaveClass('border-l-8', 'border-highlight');
        expect(within(named(name)).getByText(/on the critical path/)).toHaveClass('sr-only');
      });
    });

    it('leaves steps off the critical path and plain rows unmarked', () => {
      renderTable(pie);

      ['stir', 'cook', 'potato', 'mince'].forEach((name) => {
        expect(named(name)).not.toHaveAttribute('title');
        expect(named(name)).not.toHaveClass('border-l-8');
      });
    });

    it('stops marking a cell once it is ticked', () => {
      renderTable(pie);

      fireEvent.click(named('boil'));

      expect(named('boil')).not.toHaveAttribute('title');
      expect(named('boil')).not.toHaveClass('border-l-8');
    });

    it('keeps the labels inside the sticky text so they stay visible while scrolling', () => {
      renderTable(pie);

      fireEvent.click(startTimer());

      expect(screen.getByText('start in 10 min').closest('span.sticky')).toBe(
        screen.getByText('cook').closest('span.sticky'),
      );
    });
  });

  describe('full screen', () => {
    const enterButton = () => screen.getByRole('button', { name: 'Full screen' });
    const exitButton = () => screen.getByRole('button', { name: 'Exit full screen' });

    describe('without the Fullscreen API', () => {
      it('toggles between entering and exiting full screen', () => {
        renderTable();

        fireEvent.click(enterButton());
        expect(screen.queryByRole('button', { name: 'Full screen' })).not.toBeInTheDocument();

        fireEvent.click(exitButton());
        expect(enterButton()).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Exit full screen' })).not.toBeInTheDocument();
      });

      it('shows the table and the exit button together in a full-viewport overlay', () => {
        const scroller = renderTable();

        fireEvent.click(enterButton());

        const overlay = exitButton().parentElement;
        expect(overlay).toHaveClass('fixed', 'inset-0');
        expect(overlay).toContainElement(scroller);
      });

      it('keeps ticked cells ticked on entering and leaving full screen', () => {
        renderTable();
        fireEvent.click(cell('bread'));

        fireEvent.click(enterButton());
        expect(cell('bread')).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(cell('butter'));
        fireEvent.click(exitButton());
        expect(cell('bread')).toHaveAttribute('aria-pressed', 'true');
        expect(cell('butter')).toHaveAttribute('aria-pressed', 'true');
      });

      it('keeps the same table element when toggling', () => {
        const scroller = renderTable();

        fireEvent.click(enterButton());
        expect(screen.getByRole('region', { name: 'Method' })).toBe(scroller);

        fireEvent.click(exitButton());
        expect(screen.getByRole('region', { name: 'Method' })).toBe(scroller);
      });

      it('still scrolls when ticking a cell in full screen', () => {
        const scroller = renderTable();
        fireEvent.click(enterButton());

        fireEvent.click(cell('bread'));
        fireEvent.click(cell('butter'));

        expect(scroller.scrollTo).toHaveBeenLastCalledWith({ left: 100 });
      });
    });

    describe('with the Fullscreen API', () => {
      const requestFullscreen = jest.fn();
      const exitFullscreen = jest.fn();
      let fullscreenElement: Element | null = null;

      function setFullscreenElement(element: Element | null) {
        fullscreenElement = element;
        act(() => {
          document.dispatchEvent(new Event('fullscreenchange'));
        });
      }

      beforeEach(() => {
        fullscreenElement = null;
        requestFullscreen.mockReset().mockResolvedValue(undefined);
        exitFullscreen.mockReset().mockResolvedValue(undefined);
        HTMLElement.prototype.requestFullscreen = requestFullscreen;
        document.exitFullscreen = exitFullscreen;
        Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
        Object.defineProperty(document, 'fullscreenElement', {
          configurable: true,
          get: () => fullscreenElement,
        });
      });

      afterEach(() => {
        Reflect.deleteProperty(HTMLElement.prototype, 'requestFullscreen');
        Reflect.deleteProperty(document, 'exitFullscreen');
        Reflect.deleteProperty(document, 'fullscreenEnabled');
        Reflect.deleteProperty(document, 'fullscreenElement');
      });

      it('requests full screen on the element wrapping the table and the exit button', () => {
        const scroller = renderTable();

        fireEvent.click(enterButton());

        expect(requestFullscreen).toHaveBeenCalledTimes(1);
        const wrapper = requestFullscreen.mock.contexts[0] as HTMLElement;
        expect(wrapper).toContainElement(scroller);
        expect(wrapper).toContainElement(enterButton());
      });

      it('shows the exit button once the browser reports full screen, and reverts when it leaves', () => {
        renderTable();
        fireEvent.click(enterButton());

        setFullscreenElement(requestFullscreen.mock.contexts[0] as HTMLElement);
        expect(exitButton()).toBeInTheDocument();

        setFullscreenElement(null);
        expect(enterButton()).toBeInTheDocument();
      });

      it('exits through the API rather than only clearing state', () => {
        renderTable();
        fireEvent.click(enterButton());
        setFullscreenElement(requestFullscreen.mock.contexts[0] as HTMLElement);

        fireEvent.click(exitButton());

        expect(exitFullscreen).toHaveBeenCalledTimes(1);
      });

      it('keeps ticked cells ticked while in and after leaving full screen', () => {
        renderTable();
        fireEvent.click(cell('bread'));

        fireEvent.click(enterButton());
        setFullscreenElement(requestFullscreen.mock.contexts[0] as HTMLElement);
        expect(cell('bread')).toHaveAttribute('aria-pressed', 'true');

        setFullscreenElement(null);
        expect(cell('bread')).toHaveAttribute('aria-pressed', 'true');
      });

      it('falls back to the overlay when the browser refuses full screen', async () => {
        requestFullscreen.mockRejectedValue(new Error('denied'));
        renderTable();

        fireEvent.click(enterButton());

        expect(await screen.findByRole('button', { name: 'Exit full screen' })).toBeInTheDocument();
      });
    });
  });
});
