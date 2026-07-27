// Encrypted, short-lived download tokens.
//
// A signed-but-unencrypted token (HMAC over a readable payload) is
// tamper-resistant but not opaque: the client can base64-decode it and read
// fileId straight out, even without being able to forge a new one. That
// leaks an internal identifier into the browser, DevTools and history for no
// reason — "opaque" has to mean the payload is unreadable, not just
// unforgeable. AES-256-GCM buys both: the payload is authenticated (tampering
// breaks decryption) and encrypted (nothing is recoverable without the key).
//
// The secret is applied directly as key material, not run through a
// homemade KDF. It must therefore already be full-length, random key
// material — `openssl rand -base64 32` — not a short passphrase. Truncating
// or padding an arbitrary string to fit would quietly throw away entropy; if
// a passphrase-shaped secret is ever a real requirement, the documented path
// is HKDF (`crypto.subtle.deriveKey`), not ad-hoc slicing.

const KEY_BYTES = 32;
const IV_BYTES = 12;

export type TokenPayload = {
  fileId: string;
  exp: number;
};

/** A single reason to fail decryption, deliberately not exposed to callers:
 * wrong key, tampered ciphertext, malformed shape and expiry all collapse to
 * this one outcome so no branch of the public API can distinguish them. */
export type DecryptResult =
  | { ok: true; payload: TokenPayload }
  | { ok: false };

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const withPadding = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  try {
    return decodeBase64(withPadding);
  } catch {
    return null;
  }
}

/**
 * Throws on a malformed secret rather than silently degrading. This is an
 * operational misconfiguration (a placeholder or short value never rotated
 * to a real one), not a request the caller can recover from.
 */
async function importKey(secretBase64: string): Promise<CryptoKey> {
  let raw: Uint8Array;
  try {
    raw = decodeBase64(secretBase64);
  } catch {
    throw new Error("DOWNLOAD_TOKEN_SECRET is not valid base64.");
  }

  if (raw.byteLength !== KEY_BYTES) {
    throw new Error(
      `DOWNLOAD_TOKEN_SECRET must decode to exactly ${KEY_BYTES} bytes (got ${raw.byteLength}). Generate one with: openssl rand -base64 32`,
    );
  }

  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptToken(
  secretBase64: string,
  payload: TokenPayload,
): Promise<string> {
  const key = await importKey(secretBase64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(payload)),
  );

  return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptToken(
  secretBase64: string,
  raw: string,
  now: number = Date.now(),
): Promise<DecryptResult> {
  const parts = raw.split(".");
  if (parts.length !== 2) {
    return { ok: false };
  }

  const iv = fromBase64Url(parts[0]);
  const ciphertext = fromBase64Url(parts[1]);

  if (!iv || iv.byteLength !== IV_BYTES || !ciphertext || ciphertext.byteLength === 0) {
    return { ok: false };
  }

  const key = await importKey(secretBase64);

  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  } catch {
    // Auth tag mismatch: wrong key or tampered ciphertext. Not distinguished.
    return { ok: false };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    return { ok: false };
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as TokenPayload).fileId !== "string" ||
    typeof (parsed as TokenPayload).exp !== "number"
  ) {
    return { ok: false };
  }

  const payload = parsed as TokenPayload;

  if (payload.exp <= now) {
    return { ok: false };
  }

  return { ok: true, payload };
}
