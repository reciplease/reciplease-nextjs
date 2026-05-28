import { shorten, full } from './data';

const UUID = 'dbdc02be-a311-4aee-b974-c88d3c61f51b';

describe('short UUID helpers', () => {
  it('shorten produces a shorter string than a UUID', () => {
    expect(shorten(UUID).length).toBeLessThan(UUID.length);
  });

  it('full reverses shorten', () => {
    expect(full(shorten(UUID))).toBe(UUID);
  });

  it('same UUID always produces the same short ID', () => {
    expect(shorten(UUID)).toBe(shorten(UUID));
  });
});
