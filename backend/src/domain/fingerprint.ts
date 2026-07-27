// Turns a client-controlled value (an IP address, a folio someone typed) into
// a value safe to store as a rate-limit key. A plain hash of an IPv4 address
// is enumerable offline (4 billion values, seconds to hash them all), so the
// secret has to be part of the input, not just the algorithm. HMAC gives that
// for free instead of inventing a keyed-hash construction by hand.

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * `label` namespaces the input space so an IP and a folio that happen to be
 * the same string never collide on the same fingerprint. Truncated to 22
 * base64url characters (~16 bytes) — collision-resistant enough for a rate
 * limit, not trying to be a general-purpose MAC.
 */
export async function hmacFingerprint(
  secret: string,
  label: "ip" | "folio",
  value: string,
): Promise<string> {
  const key = await importKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${label}:${value}`),
  );
  return toBase64Url(signature).slice(0, 22);
}
