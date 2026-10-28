import { findMeasure } from '@/lib/measures';

type RowIngredient = { name: string; measureId: string; amount: number };

const COUNT_SHORT_NAMES = ['item', 'pc'];

export function ingredientRowText({ name, measureId, amount }: RowIngredient, measures: Measure[]): string {
  const short = findMeasure(measureId, measures)?.short;
  const unit = short && !COUNT_SHORT_NAMES.includes(short) ? `${short} ` : '';
  return `${amount} ${unit}${name.trim()}`;
}
