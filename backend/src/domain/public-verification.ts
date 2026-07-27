// Comparisons used only by the public lookup, where the difference between
// "reject in a few microseconds" and "reject after doing the same work as a
// match" could in principle be measured by a remote attacker. Constant-time
// by construction: every byte of both inputs is inspected regardless of
// where they first differ.

export function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bytesA = encoder.encode(a);
  const bytesB = encoder.encode(b);

  // Length itself isn't secret here (phone numbers and dates are fixed-shape
  // after validation), but comparing it up front without also touching every
  // byte would reintroduce a timing difference on the one thing that isn't
  // pinned to a single length: birth dates aren't length-normalized before
  // this call. Bytes are still walked to the longer length either way.
  const length = Math.max(bytesA.length, bytesB.length);
  let diff = bytesA.length ^ bytesB.length;

  for (let i = 0; i < length; i++) {
    diff |= (bytesA[i] ?? 0) ^ (bytesB[i] ?? 0);
  }

  return diff === 0;
}
