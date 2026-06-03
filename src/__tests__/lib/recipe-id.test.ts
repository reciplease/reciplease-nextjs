import { shorten, full } from '@/lib/recipe-id';

const OBJECT_ID = '5f8d04b3d3b9a72b8c7e1a4f';

describe('short ObjectId helpers', () => {
  it('shorten produces a shorter string than an ObjectId', () => {
    expect(shorten(OBJECT_ID).length).toBeLessThan(OBJECT_ID.length);
  });

  it('full reverses shorten', () => {
    expect(full(shorten(OBJECT_ID))).toBe(OBJECT_ID);
  });

  it('same ObjectId always produces the same short ID', () => {
    expect(shorten(OBJECT_ID)).toBe(shorten(OBJECT_ID));
  });
});
