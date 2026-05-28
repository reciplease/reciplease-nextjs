import short from 'short-uuid';

const translator = short();

export function shorten(long: RecipeId): string {
  return translator.fromUUID(long);
}

export function full(short: RecipeShortId): string {
  return translator.toUUID(short);
}
