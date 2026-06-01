// MongoDB ObjectIds are 24-character hex strings (12 bytes). We encode them
// as base64url (16 characters, no padding) for shorter, URL-safe ids in the UI,
// and decode them back to the canonical 24-char hex form for the backend.
const B64URL =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function shorten(long: RecipeId): string {
  const bytes: number[] = [];
  for (let i = 0; i < long.length; i += 2) {
    bytes.push(parseInt(long.slice(i, i + 2), 16));
  }

  let short = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    short += B64URL[b0 >> 2];
    short += B64URL[((b0 & 0x03) << 4) | (b1 >> 4)];
    short += B64URL[((b1 & 0x0f) << 2) | (b2 >> 6)];
    short += B64URL[b2 & 0x3f];
  }
  return short;
}

export function full(short: RecipeShortId): string {
  const bytes: number[] = [];
  for (let i = 0; i < short.length; i += 4) {
    const c0 = B64URL.indexOf(short[i]);
    const c1 = B64URL.indexOf(short[i + 1]);
    const c2 = B64URL.indexOf(short[i + 2]);
    const c3 = B64URL.indexOf(short[i + 3]);
    bytes.push((c0 << 2) | (c1 >> 4));
    bytes.push(((c1 & 0x0f) << 4) | (c2 >> 2));
    bytes.push(((c2 & 0x03) << 6) | c3);
  }
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}
