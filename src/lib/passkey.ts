// Client-side WebAuthn ceremony helpers. These rely on the browser's own WebAuthn JSON
// serialization (PublicKeyCredential.parseCreationOptionsFromJSON/parseRequestOptionsFromJSON
// and credential.toJSON()) rather than hand-rolled base64url<->ArrayBuffer conversion — the
// backend's options/credential JSON already speaks that same shape (see PasskeyController in
// the reciplease backend), so there's nothing to translate.

type PasskeyResult = { ok: true } | { ok: false; error: string };

// TypeScript's bundled DOM lib doesn't yet type the WebAuthn JSON serialization extension
// (https://w3c.github.io/webauthn/#sctn-parseCreationOptionsFromJSON) that browsers already
// ship (Chrome 122+, Safari 18+, Firefox 122+) — cast through this rather than fighting the
// global PublicKeyCredential ambient declaration with module augmentation. Read lazily
// (inside functions, not at module scope) since PublicKeyCredential doesn't exist in
// non-browser environments (e.g. Jest/jsdom) this module still needs to be importable in.
function publicKeyCredentialJSON() {
  return PublicKeyCredential as unknown as {
    parseCreationOptionsFromJSON(options: unknown): PublicKeyCredentialCreationOptions;
    parseRequestOptionsFromJSON(options: unknown): PublicKeyCredentialRequestOptions;
  };
}

function toJSON(credential: PublicKeyCredential): unknown {
  return (credential as unknown as { toJSON(): unknown }).toJSON();
}

async function startCeremony(optionsPath: string): Promise<{ challenge: string; optionsJson: Record<string, unknown> } | null> {
  const res = await fetch(optionsPath, { method: 'POST' });
  if (!res.ok) return null;
  const optionsJson = await res.json();
  return { challenge: optionsJson.challenge, optionsJson };
}

/** Registers a new passkey for the already signed-in user (Settings page). */
export async function registerPasskey(label?: string): Promise<PasskeyResult> {
  const started = await startCeremony('/api/passkey/register/options');
  if (!started) return { ok: false, error: 'Could not start passkey registration.' };

  let credential: PublicKeyCredential;
  try {
    const options = publicKeyCredentialJSON().parseCreationOptionsFromJSON(started.optionsJson);
    credential = (await navigator.credentials.create({ publicKey: options })) as PublicKeyCredential;
  } catch {
    return { ok: false, error: 'Passkey creation was cancelled or failed.' };
  }

  const finishRes = await fetch('/api/passkey/register/finish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challenge: started.challenge, credential: toJSON(credential), label: label ?? null }),
  });
  if (finishRes.status === 409) return { ok: false, error: 'That passkey is already linked to a different account.' };
  if (!finishRes.ok) return { ok: false, error: 'Could not register that passkey. Please try again.' };
  return { ok: true };
}

/**
 * Runs the browser side of a passkey signup or login ceremony, returning the
 * `{mode, challenge, credential}` fields {@link signIn}('passkey', ...) needs — the backend
 * verification and JWT minting happens inside NextAuth's CredentialsProvider.authorize()
 * (see auth-options.ts), not here.
 */
export async function passkeySignInCredentials(
  mode: 'signup' | 'login',
): Promise<{ ok: true; mode: 'signup' | 'login'; challenge: string; credential: string } | { ok: false; error: string }> {
  const optionsPath = mode === 'signup' ? '/api/passkey/signup/options' : '/api/passkey/login/options';
  const started = await startCeremony(optionsPath);
  if (!started) return { ok: false, error: `Could not start passkey ${mode === 'signup' ? 'sign-up' : 'sign-in'}.` };

  try {
    const credential =
      mode === 'signup'
        ? ((await navigator.credentials.create({
            publicKey: publicKeyCredentialJSON().parseCreationOptionsFromJSON(started.optionsJson),
          })) as PublicKeyCredential)
        : ((await navigator.credentials.get({
            publicKey: publicKeyCredentialJSON().parseRequestOptionsFromJSON(started.optionsJson),
          })) as PublicKeyCredential);

    return { ok: true, mode, challenge: started.challenge, credential: JSON.stringify(toJSON(credential)) };
  } catch {
    return { ok: false, error: 'Passkey sign-in was cancelled or failed.' };
  }
}
