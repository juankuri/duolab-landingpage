import { describe, expect, it } from "vitest";

import {
  FILE_STATUSES,
  type FileStatus,
  canDelete,
  canTransition,
  isFileStatus,
} from "../src/domain/file-lifecycle";

// The state machine is a pure function, so it can be checked exhaustively
// rather than sampled. These tests describe the intended lifecycle; the
// endpoints are held to it as each transition is implemented.

const ALLOWED: ReadonlyArray<[FileStatus, FileStatus]> = [
  ["UPLOADED", "CONFIRMED"],
  ["CONFIRMED", "PUBLISHED"],
  // withdraw: the one cycle, confined to the pre-publication half
  ["CONFIRMED", "UPLOADED"],
  ["PUBLISHED", "REVOKED"],
];

describe("canTransition", () => {
  it("allows exactly the lifecycle moves and nothing else", () => {
    for (const from of FILE_STATUSES) {
      for (const to of FILE_STATUSES) {
        const expected = ALLOWED.some(([a, b]) => a === from && b === to);

        expect(canTransition(from, to), `${from} -> ${to}`).toBe(expected);
      }
    }
  });

  it("treats REVOKED as terminal", () => {
    for (const to of FILE_STATUSES) {
      expect(canTransition("REVOKED", to), `REVOKED -> ${to}`).toBe(false);
    }
  });

  it("does not allow a status to transition to itself", () => {
    for (const status of FILE_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("does not allow skipping confirmation before publishing", () => {
    expect(canTransition("UPLOADED", "PUBLISHED")).toBe(false);
  });
});

describe("canDelete", () => {
  it("permits removal only of a file nobody has vouched for", () => {
    expect(canDelete("UPLOADED")).toBe(true);
    // Confirmed files must be withdrawn first; published ones are revoked.
    expect(canDelete("CONFIRMED")).toBe(false);
    expect(canDelete("PUBLISHED")).toBe(false);
    expect(canDelete("REVOKED")).toBe(false);
  });
});

describe("the withdraw cycle", () => {
  it("exists only before publication", () => {
    expect(canTransition("CONFIRMED", "UPLOADED")).toBe(true);
    // Nothing after publication may step backwards.
    expect(canTransition("PUBLISHED", "CONFIRMED")).toBe(false);
    expect(canTransition("PUBLISHED", "UPLOADED")).toBe(false);
    expect(canTransition("REVOKED", "PUBLISHED")).toBe(false);
  });
});

describe("isFileStatus", () => {
  it("accepts the four known statuses", () => {
    for (const status of FILE_STATUSES) {
      expect(isFileStatus(status)).toBe(true);
    }
  });

  it("rejects anything else, including the list-only NO_FILE placeholder", () => {
    for (const value of ["NO_FILE", "uploaded", "", null, undefined, 1]) {
      expect(isFileStatus(value), String(value)).toBe(false);
    }
  });
});
