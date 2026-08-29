// Client-side WebAuthn ceremony helpers. These rely on the browser's own WebAuthn JSON
// serialization (PublicKeyCredential.parseCreationOptionsFromJSON/parseRequestOptionsFromJSON
// and credential.toJSON()) rather than hand-rolled base64url<->ArrayBuffer conversion — the
// backend's options/credential JSON already speaks that same shape (see PasskeyController in
// the reciplease backend), so there's nothing to translate.

type PasskeyResult = { ok: true } | { ok: false; error: string };

// TypeScript's bundled DOM lib doesn't yet type the WebAuthn JSON serialization extension
// (https://w3c.github.io/webauthn/#sctn-parseCreationOptionsFromJSON) that browsers already
// ship (Chrome 122+, Safari 18+, Firefox 122+). The instance-side method (`credential.toJSON()`)
// can be added with a plain `declare global { interface PublicKeyCredential { ... } }`
// augmentation below — TypeScript merges that straight into the existing ambient interface,
// so no cast is needed at the call site.
declare global {
  interface PublicKeyCredential {
    toJSON(): unknown;
  }
}

// The two static methods (`parseCreationOptionsFromJSON`/`parseRequestOptionsFromJSON`) live on
// the `PublicKeyCredential` *constructor*, which lib.dom.d.ts declares as `declare var
// PublicKeyCredential: { ... }` — an anonymous object type, not a named interface. TypeScript
// only merges declarations of the same *named* type (interfaces, namespaces); a `declare var`
// re-declaration requires the type to be identical to the existing one, so there is no
// augmentation target for adding methods to it (verified: re-declaring `var PublicKeyCredential`
// with the extra methods included fails with TS2403 "Subsequent variable declarations must have
// the same type", even when every original member is copied over). A same-shape `as` cast fails
// too (TS2352, "neither type sufficiently overlaps") since the static methods below aren't part
// of the ambient type. This is one of the rare cases where casting through `unknown` is the only
// option (no clean augmentation path exists for extending a `declare var`-typed global
// constructor's static side).
function publicKeyCredentialJSON() {
  // eslint-disable-next-line no-restricted-syntax -- narrow, documented exception; see comment above
  return PublicKeyCredential as unknown as {
    parseCreationOptionsFromJSON(options: unknown): PublicKeyCredentialCreationOptions;
    parseRequestOptionsFromJSON(options: unknown): PublicKeyCredentialRequestOptions;
  };
}

function toJSON(credential: PublicKeyCredential): unknown {
  return credential.toJSON();
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
