// Required for Chrome's PWA installability check (Add to Home Screen on Android).
// No caching/offline behaviour yet — just enough of a fetch handler to qualify.
self.addEventListener('fetch', () => {});
