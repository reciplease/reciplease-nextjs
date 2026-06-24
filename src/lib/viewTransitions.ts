import { useEffect, useRef } from 'react';
import type { NextRouter } from 'next/router';

type ViewTransitionDocument = Document & {
  startViewTransition: (callback: () => void | Promise<void>) => unknown;
};

function supportsViewTransitions(doc: Document): doc is ViewTransitionDocument {
  return typeof (doc as Partial<ViewTransitionDocument>).startViewTransition === 'function';
}

function reduceMotionActive(): boolean {
  return document.documentElement.classList.contains('reduce-motion');
}

// Pages Router swaps `Component`/`pageProps` via React state rather than a real
// DOM navigation, so we open a view transition on `routeChangeStart` and hold
// its `updateCallback` promise open until the navigation finishes.
//
// Crucially we end the transition on `routeChangeComplete`/`routeChangeError`
// (and clear any leftover one when a new navigation starts). The old version
// only resolved when `router.asPath` changed — so a cancelled navigation, a
// click to the current route, or rapid clicks left the transition open, and the
// browser froze the whole page for its ~4s update-callback timeout. That was the
// intermittent "UI is slow to react to clicks".
export function useViewTransitionRouter(router: NextRouter) {
  const resolveRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    // End any open transition. Safe to call repeatedly.
    const finish = () => {
      resolveRef.current?.();
      resolveRef.current = null;
    };

    const start = () => {
      if (reduceMotionActive() || !supportsViewTransitions(document)) return;
      finish(); // close a previous transition that never finished (cancelled nav, etc.)
      document.startViewTransition(
        () => new Promise<void>((resolve) => {
          resolveRef.current = resolve;
        }),
      );
    };

    router.events.on('routeChangeStart', start);
    router.events.on('routeChangeComplete', finish);
    router.events.on('routeChangeError', finish);
    return () => {
      router.events.off('routeChangeStart', start);
      router.events.off('routeChangeComplete', finish);
      router.events.off('routeChangeError', finish);
      finish();
    };
  }, [router.events]);
}
