import { describe, expect, it } from "vitest";

import {
  buildFolio,
  FOLIO_SEQUENCE_PREFIX,
  initialsFromName,
  labDayUtcBounds,
  labLocalDDMMYY,
  nextDailySequence,
  parseSequence,
  stripDiacritics,
  suggestFolio,
} from "../src/domain/folio";

// Same case table as frontend/test/folio.test.js's initialsFromName() tests
// (and frontend/src/scripts/admin/folio.js is what this ports from) — kept
// in sync by hand so the client's live suggestion and the server's
// authoritative one cannot silently disagree about what a name's initials
// are, only about the sequence number (which only the server can know).
describe("stripDiacritics / initialsFromName", () => {
  it("drops accents but keeps the base letter", () => {
    expect(stripDiacritics("Ángel Núñez")).toBe("Angel Nunez");
  });

  it("2 words: first two letters of each", () => {
    expect(initialsFromName("Maria Lopez")).toBe("MALO");
  });

  it("3 words: two letters of the first, one of each of the rest", () => {
    expect(initialsFromName("Mario Jimenez Perez")).toBe("MAJP");
  });

  it("1 word: padded with X to 4 characters", () => {
    expect(initialsFromName("Alejandro")).toBe("ALEJ");
  });

  it("4+ words: first letter of the first four", () => {
    expect(initialsFromName("Juan Pablo Kuri Ricardez")).toBe("JPKR");
  });

  it("drops Spanish particles before taking initials", () => {
    expect(initialsFromName("Ana de la Torre")).toBe(initialsFromName("Ana Torre"));
  });

  it("empty name yields empty initials", () => {
    expect(initialsFromName("")).toBe("");
    expect(initialsFromName("   ")).toBe("");
  });
});

describe("labLocalDDMMYY — the lab's own calendar day, not UTC", () => {
  it("formats a UTC instant safely inside the lab's daytime", () => {
    // 2026-08-04 15:00 UTC is 2026-08-04 09:00 in UTC-6 — same calendar day.
    expect(labLocalDDMMYY(new Date("2026-08-04T15:00:00Z"))).toBe("040826");
  });

  it("stays on the previous lab-day for the first hours of UTC's next day", () => {
    // 2026-08-05 03:00 UTC is 2026-08-04 21:00 in UTC-6 — still Aug 4 for the lab.
    expect(labLocalDDMMYY(new Date("2026-08-05T03:00:00Z"))).toBe("040826");
  });

  it("rolls over at the lab's own midnight, 06:00 UTC", () => {
    expect(labLocalDDMMYY(new Date("2026-08-05T05:59:59Z"))).toBe("040826");
    expect(labLocalDDMMYY(new Date("2026-08-05T06:00:00Z"))).toBe("050826");
  });
});

describe("labDayUtcBounds", () => {
  it("returns the UTC [start, end) pair for the lab-local day, in SQLite CURRENT_TIMESTAMP's format", () => {
    const bounds = labDayUtcBounds(new Date("2026-08-04T15:00:00Z"));
    expect(bounds.startUtc).toBe("2026-08-04 06:00:00");
    expect(bounds.endUtc).toBe("2026-08-05 06:00:00");
  });

  it("agrees with labLocalDDMMYY across the same rollover instant", () => {
    const justBefore = new Date("2026-08-05T05:59:59Z");
    const justAfter = new Date("2026-08-05T06:00:00Z");

    expect(labDayUtcBounds(justBefore).startUtc).toBe("2026-08-04 06:00:00");
    expect(labDayUtcBounds(justAfter).startUtc).toBe("2026-08-05 06:00:00");
    expect(labLocalDDMMYY(justBefore)).toBe("040826");
    expect(labLocalDDMMYY(justAfter)).toBe("050826");
  });
});

describe("parseSequence / buildFolio", () => {
  it("round-trips a folio built from a base and a sequence", () => {
    const folio = buildFolio("JPKR-040826", 1);
    expect(folio).toBe(`JPKR-040826-${FOLIO_SEQUENCE_PREFIX}1`);
    expect(parseSequence(folio)).toBe(1);
  });

  it("matches the corrected example folios verbatim", () => {
    expect(parseSequence("JPKR-040826-0131")).toBe(1);
    expect(parseSequence("AMLG-040826-0132")).toBe(2);
    expect(parseSequence("PRHG-040826-0133")).toBe(3);
  });

  it("does not zero-pad the counter — the 10th folio of the day is …-01310", () => {
    expect(buildFolio("XXXX-040826", 10)).toBe("XXXX-040826-01310");
    expect(parseSequence("XXXX-040826-01310")).toBe(10);
  });

  it("returns null for a folio that doesn't follow the convention", () => {
    expect(parseSequence("PAPER-FOLIO-99")).toBeNull();
    expect(parseSequence("JPKR-040826")).toBeNull();
    expect(parseSequence("JPKR-040826-99")).toBeNull(); // no FOLIO_SEQUENCE_PREFIX
  });
});

describe("nextDailySequence — global across every folio of the lab-day, not per patient", () => {
  it("starts at 1 for an empty day", () => {
    expect(nextDailySequence([])).toBe(1);
  });

  it("continues across different patients' folios on the same day", () => {
    // The exact regression this checkpoint exists to fix: the sequence used
    // to reset per initials/date base, so a second patient created the same
    // day could collide with or restart at the first patient's numbering.
    const soFar = ["JPKR-040826-0131"];
    expect(nextDailySequence(soFar)).toBe(2);

    const afterSecond = [...soFar, "AMLG-040826-0132"];
    expect(nextDailySequence(afterSecond)).toBe(3);
  });

  it("skips folios that don't match the convention rather than breaking the max", () => {
    expect(nextDailySequence(["JPKR-040826-0131", "PAPER-99", "AMLG-040826-0132"])).toBe(3);
  });

  it("a folio matching the -{PREFIX}{n} suffix always counts, regardless of what precedes it", () => {
    // parseSequence has no opinion on the initials/date portion — the
    // sequence is global, so a folio from a different base still occupies
    // a slot in the same counter. This is intentional, not a false match.
    expect(nextDailySequence(["JPKR-040826-0131", "SOME-OLD-013999"])).toBe(1000);
  });
});

describe("suggestFolio — the full suggestion", () => {
  it("combines initials, the lab-local day, and the next daily sequence", () => {
    const now = new Date("2026-08-04T15:00:00Z");
    const suggestion = suggestFolio("Juan Pablo Kuri Ricardez", now, ["AMLG-040826-0131"]);

    expect(suggestion).toEqual({
      folio: "JPKR-040826-0132",
      initials: "JPKR",
      day: "040826",
      sequence: 2,
    });
  });

  it("is the first suggestion of an empty day", () => {
    const now = new Date("2026-08-04T15:00:00Z");
    expect(suggestFolio("Maria Lopez", now, []).folio).toBe("MALO-040826-0131");
  });
});
