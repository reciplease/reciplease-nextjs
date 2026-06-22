import { render, act } from '@testing-library/react';
import { useViewTransitionRouter } from '@/lib/viewTransitions';
import type { NextRouter } from 'next/router';

function makeRouter(asPath: string) {
  const listeners: Record<string, Array<() => void>> = {};
  return {
    asPath,
    events: {
      on: (event: string, cb: () => void) => {
        (listeners[event] ??= []).push(cb);
      },
      off: (event: string, cb: () => void) => {
        listeners[event] = (listeners[event] ?? []).filter((l) => l !== cb);
      },
      emit: (event: string) => {
        (listeners[event] ?? []).forEach((cb) => cb());
      },
    },
  } as unknown as NextRouter & { events: { emit: (event: string) => void } };
}

function TestComponent({ router }: { router: NextRouter }) {
  useViewTransitionRouter(router);
  return null;
}

describe('useViewTransitionRouter', () => {
  let startViewTransition: jest.Mock;

  beforeEach(() => {
    document.documentElement.classList.remove('reduce-motion');
    startViewTransition = jest.fn((cb: () => void | Promise<void>) => {
      cb();
      return {};
    });
    (document as unknown as { startViewTransition: jest.Mock }).startViewTransition =
      startViewTransition;
  });

  afterEach(() => {
    delete (document as unknown as { startViewTransition?: jest.Mock }).startViewTransition;
  });

  it('starts a view transition on routeChangeStart', () => {
    const router = makeRouter('/recipes');
    render(<TestComponent router={router} />);

    act(() => {
      router.events.emit('routeChangeStart');
    });

    expect(startViewTransition).toHaveBeenCalledTimes(1);
  });

  it('skips the transition when reduce-motion is active', () => {
    document.documentElement.classList.add('reduce-motion');
    const router = makeRouter('/recipes');
    render(<TestComponent router={router} />);

    act(() => {
      router.events.emit('routeChangeStart');
    });

    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it('skips the transition when the browser has no support', () => {
    delete (document as unknown as { startViewTransition?: jest.Mock }).startViewTransition;
    const router = makeRouter('/recipes');
    render(<TestComponent router={router} />);

    act(() => {
      router.events.emit('routeChangeStart');
    });

    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it('unsubscribes from routeChangeStart on unmount', () => {
    const router = makeRouter('/recipes');
    const { unmount } = render(<TestComponent router={router} />);
    unmount();

    act(() => {
      router.events.emit('routeChangeStart');
    });

    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it('resolves the pending transition once the route changes', async () => {
    const router = makeRouter('/recipes');
    let resolveSpy = jest.fn();
    startViewTransition.mockImplementation((cb: () => void | Promise<void>) => {
      const result = cb();
      if (result && typeof (result as Promise<void>).then === 'function') {
        (result as Promise<void>).then(resolveSpy);
      }
      return {};
    });

    const { rerender } = render(<TestComponent router={router} />);

    act(() => {
      router.events.emit('routeChangeStart');
    });
    expect(resolveSpy).not.toHaveBeenCalled();

    const navigatedRouter = makeRouter('/recipes/abc');
    await act(async () => {
      rerender(<TestComponent router={navigatedRouter} />);
    });

    expect(resolveSpy).toHaveBeenCalledTimes(1);
  });
});
