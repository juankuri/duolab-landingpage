import { describe, expect, it } from "vitest";

import { withRef } from "../src/scripts/admin/api.js";
import {
  ACTIONS,
  STATUS,
  STATUS_ORDER,
  actionsFor,
  allows,
  labelOf,
  statusOf,
} from "../src/scripts/admin/status.js";

describe("the status vocabulary", () => {
  it("covers exactly the four statuses the schema allows", () => {
    // Mirrors the CHECK in database/migrations/0002_records.sql. A fifth entry
    // here would be a status the database cannot store.
    expect(Object.keys(STATUS).sort()).toEqual([
      "CONFIRMED",
      "PUBLISHED",
      "REVOKED",
      "UPLOADED",
    ]);
  });

  it("orders statuses along the lifecycle", () => {
    expect(STATUS_ORDER).toEqual(["UPLOADED", "CONFIRMED", "PUBLISHED", "REVOKED"]);
  });

  it("calls UPLOADED 'Borrador' — the one noun, everywhere", () => {
    // The regression this pins: the label used to be "Subido · pendiente de
    // confirmar" in the detail pane and "Borrador" in list rows.
    expect(labelOf("UPLOADED")).toBe("Borrador");
  });

  it("gives every status a glyph as well as a label", () => {
    // Colour is never the only signal (WCAG 1.4.1).
    for (const [name, state] of Object.entries(STATUS)) {
      expect(state.glyph, name).toBeTruthy();
      expect(state.label, name).toBeTruthy();
      expect(state.tone, name).toBeTruthy();
    }
  });

  it("gives every status a distinct glyph and label", () => {
    const glyphs = Object.values(STATUS).map((s) => s.glyph);
    const labels = Object.values(STATUS).map((s) => s.label);

    expect(new Set(glyphs).size).toBe(glyphs.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("falls back rather than rendering a raw enum value", () => {
    expect(statusOf("NO_FILE").label).toBe("Sin resultado");
    expect(statusOf(undefined).label).toBe("Sin resultado");
  });
});

describe("the actions a status offers", () => {
  it("lets a draft be confirmed, replaced or deleted, but never published", () => {
    expect(actionsFor("UPLOADED")).toContain("confirm");
    expect(allows("UPLOADED", "publish")).toBe(false);
  });

  it("lets a confirmed result be published or withdrawn", () => {
    expect(allows("CONFIRMED", "publish")).toBe(true);
    expect(allows("CONFIRMED", "withdraw")).toBe(true);
  });

  it("never offers to delete a result a patient could have seen", () => {
    // Mirrors canDelete in backend/src/domain/file-lifecycle.ts: only UPLOADED.
    expect(allows("PUBLISHED", "delete")).toBe(false);
    expect(allows("REVOKED", "delete")).toBe(false);
    expect(allows("CONFIRMED", "delete")).toBe(false);
  });

  it("never offers to confirm or publish something already published", () => {
    expect(allows("PUBLISHED", "confirm")).toBe(false);
    expect(allows("PUBLISHED", "publish")).toBe(false);
  });

  it("treats REVOKED as terminal — read-only", () => {
    // DEC-007: a revoked result is never published again.
    expect(actionsFor("REVOKED")).toEqual(["preview"]);
  });

  it("has no actions for a status it does not know", () => {
    expect(actionsFor("NO_FILE")).toEqual([]);
  });

  it("defines actions for every status and no others", () => {
    expect(Object.keys(ACTIONS).sort()).toEqual(Object.keys(STATUS).sort());
  });
});

describe("withRef", () => {
  it("uses the server's message for any error code", () => {
    expect(
      withRef({ code: "INVALID_TRANSITION", error: "No se pudo." }, "fallback"),
    ).toBe("No se pudo.");
  });

  it("falls back to the given message when there is no payload at all", () => {
    expect(withRef(null, "fallback")).toBe("fallback");
    expect(withRef(undefined, "fallback")).toBe("fallback");
  });

  it("appends the request id when the server logged one", () => {
    expect(
      withRef({ error: "Algo falló.", requestId: "abc-123" }, "fallback"),
    ).toBe("Algo falló. (Ref: abc-123)");
  });
});
