#!/usr/bin/env node
// Mints a Reciplease session JWT for local manual testing, matching what the
// backend's ReciplaseJwtService produces (HS256, `sub` = user id, 24h expiry).
//
// Usage:
//   node scripts/mint-dev-token.mjs <userId> [hours]
//
// The signing secret comes from $RECIPLEASE_JWT_SIGNING_SECRET if set, otherwise
// it's fetched from Google Secret Manager (reciplease-jwt-signing-secret — needs
// an authed gcloud). The secret itself is never printed; only the minted token is.
//
// Typical flow (see .claude/skills/verify/SKILL.md for the full local-dev recipe):
//   RECIPLEASE_DEV_TOKEN=$(node scripts/mint-dev-token.mjs <userId>) \
//   BACKEND_URL=https://app.reciplease.org NEXT_PUBLIC_AUTH_DISABLED=true \
//   NEXTAUTH_SECRET=dev NEXTAUTH_URL=http://localhost:3000 \
//   GOOGLE_CLIENT_ID=x GOOGLE_CLIENT_SECRET=x yarn dev

import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const [userId, hoursArg] = process.argv.slice(2);
if (!userId) {
  console.error('usage: node scripts/mint-dev-token.mjs <userId> [hours]');
  process.exit(2);
}
const hours = hoursArg ? Number(hoursArg) : 24;
if (!Number.isFinite(hours) || hours <= 0) {
  console.error(`invalid hours: ${hoursArg}`);
  process.exit(2);
}

function signingSecret() {
  const fromEnv = process.env.RECIPLEASE_JWT_SIGNING_SECRET;
  if (fromEnv) return fromEnv;
  try {
    return execFileSync(
      'gcloud',
      ['secrets', 'versions', 'access', 'latest', '--secret=reciplease-jwt-signing-secret'],
      { encoding: 'utf8' },
    ).trim();
  } catch {
    console.error(
      'could not resolve the signing secret: set $RECIPLEASE_JWT_SIGNING_SECRET or authenticate gcloud',
    );
    process.exit(1);
  }
}

const b64url = (input) => Buffer.from(input).toString('base64url');

const now = Math.floor(Date.now() / 1000);
const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
const payload = b64url(JSON.stringify({ sub: userId, iat: now, exp: now + hours * 3600 }));
const signature = createHmac('sha256', signingSecret())
  .update(`${header}.${payload}`)
  .digest('base64url');

console.log(`${header}.${payload}.${signature}`);
