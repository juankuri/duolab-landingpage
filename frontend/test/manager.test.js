import { describe, expect, it } from "vitest";

import {
  TABS,
  nextPending,
  publishRecovery,
  queueItems,
  revokeConfirmBody,
  revokedExplanation,
  statusForTab,
  tabLabel,
  transitionConflictMessage,
} from "../src/scripts/admin/manager.js";

describe("TABS", () => {
  it("has exactly the three tabs, in lifecycle order", () => {
    expect(TABS.map((t) => t.id)).toEqual(["pending", "published", "revoked"]);
    expect(TABS.map((t) => t.status)).toEqual(["CONFIRMED", "PUBLISHED", "REVOKED"]);
  });

  it("looks up a tab's label and status", () => {
    expect(tabLabel("pending")).toBe("Por publicar");
    expect(statusForTab("published")).toBe("PUBLISHED");
  });

  it("returns an empty label for an unknown tab", () => {
    expect(tabLabel("bogus")).toBe("");
    expect(statusForTab("bogus")).toBeUndefined();
  });
});

describe("queueItems", () => {
  it("flattens one row per file, tagged with its record's folio and patient", () => {
    const records = [
      {
        recordId: "r1",
        folio: "A-1024",
        patientName: "Juan Pablo Kuri",
        files: [{ fileId: "f1", originalFilename: "a.pdf", status: "CONFIRMED" }],
      },
    ];

    expect(queueItems(records, "CONFIRMED")).toEqual([
      {
        recordId: "r1",
        folio: "A-1024",
        patientName: "Juan Pablo Kuri",
        fileId: "f1",
        originalFilename: "a.pdf",
        status: "CONFIRMED",
        sequence: undefined,
        uploadedAt: undefined,
        previewUrl: undefined,
      },
    ]);
  });

  it("skips a record with an empty files array", () => {
    const records = [{ recordId: "r1", folio: "A-1", patientName: "X", files: [] }];
    expect(queueItems(records, "CONFIRMED")).toEqual([]);
  });

  it("skips a record missing the files key entirely", () => {
    const records = [{ recordId: "r1", folio: "A-1", patientName: "X" }];
    expect(queueItems(records, "CONFIRMED")).toEqual([]);
  });

  it("filters out files that don't match the requested status", () => {
    const records = [
      {
        recordId: "r1",
        folio: "A-1",
        patientName: "X",
        files: [
          { fileId: "f1", status: "UPLOADED" },
          { fileId: "f2", status: "CONFIRMED" },
        ],
      },
    ];

    expect(queueItems(records, "CONFIRMED").map((i) => i.fileId)).toEqual(["f2"]);
  });

  it("returns every file when no status filter is given", () => {
    const records = [
      { recordId: "r1", folio: "A-1", patientName: "X", files: [{ fileId: "f1", status: "UPLOADED" }] },
    ];

    expect(queueItems(records).map((i) => i.fileId)).toEqual(["f1"]);
  });

  it("handles a record appearing with files in two different tabs' worth of state", () => {
    const records = [
      {
        recordId: "r1",
        folio: "A-1",
        patientName: "X",
        files: [
          { fileId: "f1", status: "PUBLISHED" },
          { fileId: "f2", status: "CONFIRMED" },
        ],
      },
    ];

    expect(queueItems(records, "PUBLISHED").map((i) => i.fileId)).toEqual(["f1"]);
    expect(queueItems(records, "CONFIRMED").map((i) => i.fileId)).toEqual(["f2"]);
  });

  it("returns nothing for an empty or missing records list", () => {
    expect(queueItems([], "CONFIRMED")).toEqual([]);
    expect(queueItems(undefined, "CONFIRMED")).toEqual([]);
  });
});

describe("nextPending", () => {
  const items = [
    { recordId: "r1", fileId: "f1" },
    { recordId: "r2", fileId: "f2" },
    { recordId: "r3", fileId: "f3" },
  ];

  it("picks the first item that isn't the one just published", () => {
    expect(nextPending(items, "r1")).toEqual({ recordId: "r2", fileId: "f2", remaining: 2 });
  });

  it("returns null when the only item was the one just published", () => {
    expect(nextPending([{ recordId: "r1", fileId: "f1" }], "r1")).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(nextPending([], "r1")).toBeNull();
  });

  it("handles duplicate record ids (two files on the same folio) by excluding all of them", () => {
    const withDuplicate = [
      { recordId: "r1", fileId: "f1" },
      { recordId: "r1", fileId: "f1b" },
      { recordId: "r2", fileId: "f2" },
    ];
    expect(nextPending(withDuplicate, "r1")).toEqual({ recordId: "r2", fileId: "f2", remaining: 1 });
  });

  it("picks the first item when nothing was just published", () => {
    expect(nextPending(items, null)).toEqual({ recordId: "r1", fileId: "f1", remaining: 3 });
  });
});

describe("publishRecovery", () => {
  it("extracts the currently-published file to retry a supersede", () => {
    expect(
      publishRecovery({
        code: "ALREADY_PUBLISHED",
        currentFileId: "f-old",
        currentFilename: "anterior.pdf",
      }),
    ).toEqual({ supersedes: "f-old", currentFilename: "anterior.pdf" });
  });

  it("still returns a recovery when currentFilename is missing", () => {
    expect(publishRecovery({ code: "ALREADY_PUBLISHED", currentFileId: "f-old" })).toEqual({
      supersedes: "f-old",
      currentFilename: null,
    });
  });

  it("returns null for any other error code", () => {
    expect(publishRecovery({ code: "INVALID_TRANSITION" })).toBeNull();
    expect(publishRecovery(null)).toBeNull();
    expect(publishRecovery(undefined)).toBeNull();
  });
});

describe("transitionConflictMessage", () => {
  const labelOf = (status) => ({ PUBLISHED: "Publicado", REVOKED: "Revocado" })[status] ?? status;

  it("names the current status using the shared label vocabulary", () => {
    expect(
      transitionConflictMessage({ details: { currentStatus: "PUBLISHED" } }, labelOf),
    ).toBe("Otra persona ya cambió este resultado (ahora: Publicado).");
  });

  it("falls back gracefully when there is no detail at all", () => {
    expect(transitionConflictMessage({}, labelOf)).toBe(
      "Otra persona ya cambió este resultado (ahora: otro estado).",
    );
  });
});

describe("revoke copy — REVOKED must read as terminal (DEC-007/DEC-014)", () => {
  it("says revoking is definitive and names the correction path", () => {
    const body = revokeConfirmBody({ patientName: "Luis Herrera", folio: "A-1023" });

    expect(body).toContain("Luis Herrera");
    expect(body).toContain("A-1023");
    expect(body).toContain("definitivo");
    expect(body).toContain("no se puede volver a publicar");
    // The prototype's mistaken promise must never resurface here.
    expect(body).not.toContain("podrás volver a publicar");
    expect(body).not.toContain("más tarde");
  });

  it("explains a revoked result the same way, with who and when", () => {
    const text = revokedExplanation({
      revokedBy: "gerencia@duolab.test",
      revokedAt: "2026-07-26T09:12:00",
      formatMoment: () => "26 jul · 09:12",
    });

    expect(text).toContain("26 jul · 09:12");
    expect(text).toContain("gerencia@duolab.test");
    expect(text).toContain("no puede volver a publicarse");
  });
});
