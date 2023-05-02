import short from 'short-uuid';

const translator = short();

export function shorten(long: string): string {
  return translator.fromUUID(long);
}

export function full(short: string): string {
  return translator.toUUID(short);
}
