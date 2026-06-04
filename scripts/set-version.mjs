/**
 * Writes NEXT_PUBLIC_APP_VERSION=YYYY.MM.DD-<hash> to .env.production.local
 * before `next build` runs. Matches the backend versioning convention.
 *
 * Version sources (first one that works):
 *   1. COMMIT_REF env var (set by Netlify CI)
 *   2. git log (local builds)
 *   3. "dev" fallback
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

function shortHash() {
  // Netlify sets COMMIT_REF to the full SHA
  const ref = process.env.COMMIT_REF;
  if (ref) return ref.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'dev';
  }
}

const date = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
const version = `${date}-${shortHash()}`;

writeFileSync('.env.production.local', `NEXT_PUBLIC_APP_VERSION=${version}\n`);

console.log(`App version: ${version}`);
