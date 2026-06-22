import { recipeTitleTransitionName } from '@/lib/viewTransitionNames';

describe('recipeTitleTransitionName', () => {
  it('derives a stable, recipe-scoped name', () => {
    expect(recipeTitleTransitionName('abc-123')).toBe('recipe-title-abc-123');
  });

  it('produces different names for different recipes', () => {
    expect(recipeTitleTransitionName('a')).not.toBe(recipeTitleTransitionName('b'));
  });
});
