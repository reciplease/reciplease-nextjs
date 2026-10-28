import { act, fireEvent, render, screen } from '@testing-library/react';
import RecipeTable from '@/components/RecipeTable';

const row = (text: string): TableCell => ({ text, inputs: [] });
const step = (text: string, ...inputs: TableCell[]): TableCell => ({ text, inputs });

const toast = [step('spread', step('toast', row('bread')), row('butter'))];
const folding = [step('fold', step('mix', step('cream', row('butter'))), row('chips'))];

let tableWidth = 300;

const elementOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
const tableOffsetWidth = Object.getOwnPropertyDescriptor(HTMLTableElement.prototype, 'offsetWidth');

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
});

afterEach(() => {
  tableWidth = 300;
});

afterAll(() => {
  restoreOffsetWidth(HTMLElement.prototype, elementOffsetWidth);
  restoreOffsetWidth(HTMLTableElement.prototype, tableOffsetWidth);
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

  it('scrolls to the last column of the clicked cell when marking done', () => {
    const scroller = renderTable();

    fireEvent.click(cell('bread'));
    expect(scroller.scrollTo).toHaveBeenLastCalledWith({ left: 0 });

    fireEvent.click(cell('butter'));
    expect(scroller.scrollTo).toHaveBeenLastCalledWith({ left: 100 });

    fireEvent.click(cell('toast'));
    expect(scroller.scrollTo).toHaveBeenLastCalledWith({ left: 100 });
  });

  it('keeps a long sibling input in view when marking a cell done', () => {
    tableWidth = 400;
    const scroller = renderTable(folding);

    fireEvent.click(cell('mix'));

    expect(scroller.scrollTo).toHaveBeenLastCalledWith({ left: 200 });
  });

  it('does not scroll when marking the root cell', () => {
    const scroller = renderTable();

    fireEvent.click(cell('spread'));

    expect(scroller.scrollTo).not.toHaveBeenCalled();
  });

  it('does not scroll when un-marking a cell', () => {
    const scroller = renderTable();

    fireEvent.click(cell('bread'));
    (scroller.scrollTo as jest.Mock).mockClear();
    fireEvent.click(cell('bread'));

    expect(scroller.scrollTo).not.toHaveBeenCalled();
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
