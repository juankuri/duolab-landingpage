import { STATUS_ORDER, statusOf } from "./status.js";

/**
 * DOM builders shared by the admin screens.
 *
 * These build nodes rather than HTML strings: every value here is patient data
 * or a filename typed by someone, and textContent cannot be talked into
 * executing any of it. It also means the Astro components that render the same
 * shapes server-side and these runtime builders stay honest about being two
 * renderings of one thing — the classes and the vocabulary come from the same
 * modules either way.
 */

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/**
 * The derived summary of a folio: how many results, and how many in each state.
 *
 * This is what replaces a folio-level status. A folio has no status of its own —
 * three results can sit in three different states at once, and collapsing that
 * to one badge (which is what the old recent list did, showing only the latest
 * result's state) loses the thing the employee needs to see.
 */
export function tallyOf(results = []) {
  const byStatus = {};

  for (const result of results) {
    byStatus[result.status] = (byStatus[result.status] || 0) + 1;
  }

  return { total: results.length, byStatus };
}

/** Renders a tally as chips: a total, then one chip per state that is present. */
export function tallyNode(tally) {
  const wrap = el("span", "tally");
  const total = tally.total ?? 0;

  wrap.append(
    el("span", "tchip tchip--total", `${total} ${total === 1 ? "resultado" : "resultados"}`),
  );

  for (const key of STATUS_ORDER) {
    const count = tally.byStatus?.[key];
    if (!count) continue;

    const state = statusOf(key);
    const chip = el("span", `tchip tchip--${state.tone}`);
    chip.append(el("span", "tchip__glyph", state.glyph));
    chip.append(document.createTextNode(`${count} ${state.label.toLowerCase()}`));
    wrap.append(chip);
  }

  return wrap;
}

/**
 * Status badge: glyph AND text, always.
 *
 * Colour is never the only signal (WCAG 1.4.1) — the glyph carries the same
 * distinction for anyone who cannot separate the tones, and the label carries it
 * for anyone who cannot see either.
 */
export function statusBadge(value) {
  const state = statusOf(value);
  const badge = el("span", `badge badge--${state.tone}`);
  badge.append(el("span", "badge__glyph", state.glyph));
  badge.append(document.createTextNode(state.label));
  return badge;
}

/**
 * The display name of a result.
 *
 * Derived from the folio and the result's position in it, never typed: there is
 * no result-name input anywhere in this module. `sequence` is assigned by the
 * server; until that lands, the index within the folio's ordered list stands in.
 */
export function resultName(folio, result, index) {
  return `${folio} · #${result.sequence ?? index + 1}`;
}

const BYTES = ["B", "KB", "MB"];

export function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return "";

  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < BYTES.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${unit === 0 ? value : value.toFixed(1)} ${BYTES[unit]}`;
}

/**
 * "26 jul · 09:12". The uploaded_at the server stores is "YYYY-MM-DD HH:MM:SS"
 * in UTC with no zone marker, which Date parses as local time in some engines
 * and UTC in others — so the marker is added rather than left to chance.
 */
export function formatMoment(raw) {
  if (!raw) return "";

  const value = raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return raw;

  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Initials for the patient avatar. Two letters, first and last word. */
export function initials(name) {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
