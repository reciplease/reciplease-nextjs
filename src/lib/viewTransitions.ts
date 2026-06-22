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

// Pages Router swaps `Component`/`pageProps` via React state rather than a
// real DOM navigation, so we can't just wrap the navigation in
// `startViewTransition` like a classic MPA would. Instead: open the
// transition on `routeChangeStart`, holding its `updateCallback` promise open
// via `pendingResolveRef`, then resolve it once the new page has actually
// committed (signalled by the effect below re-running for the new route).
export function useViewTransitionRouter(router: NextRouter) {
  const pendingResolveRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const startTransition = () => {
      if (reduceMotionActive() || !supportsViewTransitions(document)) return;

      document.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            pendingResolveRef.current = resolve;
          })
      );
    };

    router.events.on('routeChangeStart', startTransition);
    return () => router.events.off('routeChangeStart', startTransition);
  }, [router.events]);

  // Runs after every committed navigation (route change), resolving the
  // transition opened in routeChangeStart so the browser can snapshot the
  // "after" state and run the animation.
  useEffect(() => {
    pendingResolveRef.current?.();
    pendingResolveRef.current = null;
  }, [router.asPath]);
}
