import { withRef } from "./api.js";

/**
 * The result status vocabulary — one source for every admin surface.
 *
 * Status belongs to the RESULT, never to the folio. A folio shows a derived
 * summary (see tally() in render.js); it never carries a status of its own.
 *
 * This file previously existed twice inside admin.astro as STATE_LABEL and
 * SHORT_LABEL, which disagreed: UPLOADED read "Subido · pendiente de confirmar"
 * in the detail pane and "Borrador" in list rows. Employees, managers and
 * patients are meant to read one shared vocabulary, so the noun is now always
 * "Borrador" and the explanation moved into `hint`, shown only where there is
 * room for it.
 *
 * Every badge renders `glyph` AND `label`. Colour is never the only signal
 * (WCAG 1.4.1) — the glyph carries the same distinction for anyone who cannot
 * separate the tones.
 */
export const STATUS = {
  UPLOADED: {
    label: "Borrador",
    glyph: "◑",
    tone: "draft",
    hint: "pendiente de confirmar",
  },
  CONFIRMED: {
    label: "Confirmado",
    glyph: "◐",
    tone: "confirmed",
    hint: "verificado internamente, en espera del gerente",
  },
  PUBLISHED: {
    label: "Publicado",
    glyph: "●",
    tone: "published",
    hint: "visible para el paciente",
  },
  REVOKED: {
    label: "Revocado",
    glyph: "○",
    tone: "revoked",
    hint: "oculto para el paciente",
  },
};

/**
 * Not a stored status. The API reports it for a folio whose PDF is still
 * missing — a state that stops being reachable for new folios once creation
 * becomes atomic, but which existing rows can still be in.
 */
export const NO_RESULT = {
  label: "Sin resultado",
  glyph: "—",
  tone: "none",
  hint: "",
};

/** Order used wherever statuses are listed, matching the lifecycle. */
export const STATUS_ORDER = ["UPLOADED", "CONFIRMED", "PUBLISHED", "REVOKED"];

export function statusOf(value) {
  return STATUS[value] || NO_RESULT;
}

export function labelOf(value) {
  return statusOf(value).label;
}

/**
 * Which actions a result in this state offers.
 *
 * `publish` is listed for CONFIRMED but is manager-only; the caller still has to
 * gate it on the actor's role. Keeping it here means the lifecycle lives in one
 * place and the role check stays a separate, visible concern rather than being
 * folded into the status table where it would be easy to miss.
 */
export const ACTIONS = {
  UPLOADED: ["preview", "confirm", "replace", "delete"],
  CONFIRMED: ["preview", "publish", "withdraw", "replace"],
  PUBLISHED: ["preview", "download", "replace", "revoke"],
  REVOKED: ["preview"],
};

export function actionsFor(value) {
  return ACTIONS[value] || [];
}

export function allows(value, action) {
  return actionsFor(value).includes(action);
}

/**
 * ALREADY_PUBLISHED is the one failure worth a message of its own: the
 * generic one ("no se pudo completar la acción") does not tell the actor
 * this isn't a transient error, or what to do about it. Only one result per
 * folio may be PUBLISHED at a time (DEC-010) — the fix is "Reemplazar" on
 * the currently published result (or a supersede retry), not retrying this
 * one as-is.
 *
 * Lifted out of folio.astro (where it started) so the manager screens can
 * share the same message instead of re-deriving it.
 */
export function actionErrorMessage(payload, fallback) {
  if (payload?.code === "ALREADY_PUBLISHED") {
    const name = payload.currentFilename ? ` (${payload.currentFilename})` : "";
    return `Este folio ya tiene un resultado publicado${name}. Usa "Reemplazar archivo…" sobre ese resultado para corregirlo, o revócalo primero.`;
  }

  return withRef(payload, fallback);
}
