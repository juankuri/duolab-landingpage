import { describe, expect, it } from "vitest";

import { decryptToken, encryptToken } from "../src/domain/download-token";

// 32 zero bytes, base64-encoded — a valid-shaped key for tests only.
const SECRET = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const OTHER_SECRET = "//////////////////////////////////////////8=";

describe("encryptToken / decryptToken", () => {
  it("round-trips a payload", async () => {
    const now = Date.now();
    const token = await encryptToken(SECRET, { fileId: "file-123", exp: now + 60_000 });

    const result = await decryptToken(SECRET, token, now);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).toEqual({ fileId: "file-123", exp: now + 60_000 });
    }
  });

  it("is opaque: the token does not contain the recoverable fileId or JSON", async () => {
    const token = await encryptToken(SECRET, {
      fileId: "a-very-identifiable-file-id",
      exp: Date.now() + 60_000,
    });

    expect(token).not.toContain("a-very-identifiable-file-id");
    expect(token).not.toContain("fileId");

    // The two dot-separated parts are IV and ciphertext; neither decodes to
    // readable JSON without the key.
    for (const part of token.split(".")) {
      const padded = part.replace(/-/g, "+").replace(/_/g, "/");
      const withPadding = padded + "=".repeat((4 - (padded.length % 4)) % 4);
      let decoded: string;
      try {
        decoded = atob(withPadding);
      } catch {
        continue;
      }
      expect(() => JSON.parse(decoded)).toThrow();
    }
  });

  it("rejects a token decrypted with the wrong key", async () => {
    const token = await encryptToken(SECRET, { fileId: "file-123", exp: Date.now() + 60_000 });

    const result = await decryptToken(OTHER_SECRET, token);

    expect(result.ok).toBe(false);
  });

  it("rejects a tampered ciphertext", async () => {
    const token = await encryptToken(SECRET, { fileId: "file-123", exp: Date.now() + 60_000 });
    const [iv, ciphertext] = token.split(".");
    const tampered = `${iv}.${ciphertext.slice(0, -1)}${ciphertext.at(-1) === "A" ? "B" : "A"}`;

    const result = await decryptToken(SECRET, tampered);

    expect(result.ok).toBe(false);
  });

  it("rejects a tampered IV", async () => {
    const token = await encryptToken(SECRET, { fileId: "file-123", exp: Date.now() + 60_000 });
    const [iv, ciphertext] = token.split(".");
    const tampered = `${iv.slice(0, -1)}${iv.at(-1) === "A" ? "B" : "A"}.${ciphertext}`;

    const result = await decryptToken(SECRET, tampered);

    expect(result.ok).toBe(false);
  });

  it("rejects an expired token", async () => {
    const now = Date.now();
    const token = await encryptToken(SECRET, { fileId: "file-123", exp: now - 1 });

    const result = await decryptToken(SECRET, token, now);

    expect(result.ok).toBe(false);
  });

  it("rejects a malformed token string", async () => {
    for (const bad of ["", "not-a-token", "a.b.c", "onlyonepart", "a.", ".b"]) {
      const result = await decryptToken(SECRET, bad);
      expect(result.ok, `token=${JSON.stringify(bad)}`).toBe(false);
    }
  });

  it("rejects a secret that does not decode to 32 bytes", async () => {
    await expect(
      encryptToken("dG9vLXNob3J0", { fileId: "file-123", exp: Date.now() + 60_000 }),
    ).rejects.toThrow();
  });
});
