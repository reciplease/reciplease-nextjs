import { isJwtExpired, jwtExpiryMillis } from '@/lib/jwt';

function jwtWithExp(exp: number | undefined): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(exp === undefined ? {} : { exp })).toString('base64url');
  return `${header}.${payload}.signature`;
}

describe('jwtExpiryMillis', () => {
  it('reads the exp claim in epoch milliseconds', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    expect(jwtExpiryMillis(jwtWithExp(exp))).toBe(exp * 1000);
  });

  it('returns undefined when there is no exp claim', () => {
    expect(jwtExpiryMillis(jwtWithExp(undefined))).toBeUndefined();
  });

  it('returns undefined for a malformed token', () => {
    expect(jwtExpiryMillis('not-a-jwt')).toBeUndefined();
  });

  it('returns undefined for a payload that is not valid JSON', () => {
    const badPayload = Buffer.from('not json').toString('base64url');
    expect(jwtExpiryMillis(`header.${badPayload}.sig`)).toBeUndefined();
  });
});

describe('isJwtExpired', () => {
  it('is false for a token that has not expired yet', () => {
    expect(isJwtExpired(jwtWithExp(Math.floor(Date.now() / 1000) + 3600))).toBe(false);
  });

  it('is true for a token whose exp is in the past', () => {
    expect(isJwtExpired(jwtWithExp(Math.floor(Date.now() / 1000) - 60))).toBe(true);
  });

  it('is true for a token with no exp claim', () => {
    expect(isJwtExpired(jwtWithExp(undefined))).toBe(true);
  });

  it('is true for a malformed token', () => {
    expect(isJwtExpired('garbage')).toBe(true);
  });
});
