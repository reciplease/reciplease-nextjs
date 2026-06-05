import '@testing-library/jest-dom';

// jsdom doesn't implement matchMedia, which the SettingsProvider uses to read
// prefers-color-scheme / prefers-reduced-motion. Default to "not matched".
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// jsdom doesn't implement HTMLDialogElement's methods, which the <dialog>-based
// modals (e.g. the scanner's IngredientModal) call. Provide minimal stand-ins.
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal =
    HTMLDialogElement.prototype.showModal ||
    function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
  HTMLDialogElement.prototype.show =
    HTMLDialogElement.prototype.show ||
    function show(this: HTMLDialogElement) {
      this.open = true;
    };
  HTMLDialogElement.prototype.close =
    HTMLDialogElement.prototype.close ||
    function close(this: HTMLDialogElement, returnValue?: string) {
      this.open = false;
      if (returnValue !== undefined) this.returnValue = returnValue;
      this.dispatchEvent(new Event('close'));
    };
}
