import { describeTiming } from '@/lib/recipe-timing';

describe('describeTiming', () => {
  it('describes prep time, cook time and servings', () => {
    expect(describeTiming({ prepTimeMinutes: 5, cookTimeMinutes: 40, servings: 4 })).toEqual([
      'Prep 5 min',
      'Cook 40 min',
      'Serves 4',
    ]);
  });

  it('omits fields that are null or undefined', () => {
    expect(describeTiming({ prepTimeMinutes: null, cookTimeMinutes: 40 })).toEqual(['Cook 40 min']);
    expect(describeTiming({})).toEqual([]);
  });

  it('formats durations of an hour or more', () => {
    expect(describeTiming({ cookTimeMinutes: 60 })).toEqual(['Cook 1 h']);
    expect(describeTiming({ cookTimeMinutes: 70 })).toEqual(['Cook 1 h 10 min']);
    expect(describeTiming({ prepTimeMinutes: 150 })).toEqual(['Prep 2 h 30 min']);
  });

  it('keeps a zero prep time', () => {
    expect(describeTiming({ prepTimeMinutes: 0 })).toEqual(['Prep 0 min']);
  });
});
