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
 * The `uploaded_at`/`revoked_at` the server stores is "YYYY-MM-DD HH:MM:SS" in
 * UTC with no zone marker, which Date parses as local time in some engines and
 * UTC in others — so the marker is added rather than left to chance. Returns
 * `null` (not the raw string) when the value doesn't parse, so callers can
 * tell "no date" from "a valid one".
 */
export function parseMoment(raw) {
  if (!raw) return null;

  const value = raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "26 jul · 09:12". */
export function formatMoment(raw) {
  if (!raw) return "";

  const date = parseMoment(raw);
  if (!date) return raw;

  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Sets (or clears) a `role="status"` line's text and tone.
 *
 * Every admin page hand-rolled this same three-line closure independently
 * (index, buscar, nuevo, folio, revisar, paciente) — one shared setter so a
 * future change to the tone convention only has to happen once.
 */
export function setStatusLine(node, message, tone) {
  node.textContent = message || "";
  if (tone) node.dataset.tone = tone;
  else delete node.dataset.tone;
}

/**
 * Fills a page's `.empty` block (title + optional sub) and shows it. Callers
 * pass the nodes rather than ids so this stays independent of any one page's
 * id scheme.
 */
export function renderEmpty({ container, title: titleNode, sub: subNode }, title, sub) {
  if (titleNode) titleNode.textContent = title ?? "";
  if (subNode) subNode.textContent = sub ?? "";
  container.hidden = false;
}

/**
 * One folio row: folio → patient name, plus its tally. Used by /admin,
 * /admin/buscar and /admin/paciente, previously three near-identical inline
 * builders differing only in which link they pointed at.
 */
export function folioRowNode(folio, { href, metaText } = {}) {
  const li = document.createElement("li");
  li.className = "frow";

  const link = document.createElement("a");
  link.href = href ?? `/admin/folio?f=${encodeURIComponent(folio.folio)}`;
  link.className = "frow__body";
  link.style.textDecoration = "none";
  link.style.color = "inherit";

  const nameNode = el("p", "frow__name truncate", folio.folio);
  nameNode.title = folio.folio;
  link.append(nameNode);

  const meta = metaText === undefined ? folio.patientName : metaText;
  if (meta) {
    const metaNode = el("p", "frow__meta truncate", meta);
    metaNode.title = meta;
    link.append(metaNode);
  }

  li.append(link, tallyNode(folio.results));
  return li;
}

/** One patient row: avatar, name, phone + folio count. Used by /admin/buscar. */
export function patientRowNode(patient) {
  const li = document.createElement("li");
  li.className = "frow";

  const avatar = el("span", "pavatar", initials(patient.fullName));
  avatar.setAttribute("aria-hidden", "true");

  const link = document.createElement("a");
  link.href = `/admin/paciente?id=${encodeURIComponent(patient.patientId)}`;
  link.className = "frow__body";
  link.style.textDecoration = "none";
  link.style.color = "inherit";

  const folioWord = patient.folioCount === 1 ? "folio" : "folios";
  const nameNode = el("p", "frow__name truncate", patient.fullName);
  nameNode.title = patient.fullName;
  link.append(
    nameNode,
    el("p", "frow__meta", `${patient.phoneNumber} · ${patient.folioCount} ${folioWord}`),
  );

  li.append(avatar, link);
  return li;
}

/**
 * Fills the patient-summary card markup repeated (statically, per page) on
 * /admin/folio, /admin/revisar and /admin/paciente: avatar initials, name,
 * and a `birthDate · phoneNumber` meta line. Each page owns its own markup
 * (the ids differ slightly) and passes the three nodes in; this just keeps
 * the fill logic itself from being copy-pasted a third time.
 */
export function fillPatientCard({ avatar, name, meta }, patient) {
  if (avatar) avatar.textContent = initials(patient.fullName);
  // The name node is visually clamped (`.clamp-2` in admin.css) for the
  // hostile-data case — a 120-character name or one unbroken 60-character
  // word — so `title` is what lets someone actually read the full value,
  // not just the CSS ellipsis.
  name.textContent = patient.fullName;
  name.title = patient.fullName;
  if (meta) {
    const metaText = `${patient.birthDate} · ${patient.phoneNumber}`;
    meta.textContent = metaText;
    meta.title = metaText;
  }
}

/**
 * The null convention (docs/09-ux-completion-plan.md §C3): null, undefined
 * and "" never render as a blank cell — a blank cannot be told apart from
 * "still loading" or "the query broke". Renders an explicit em dash with an
 * accessible label instead. Every screen that shows optional or
 * caller-supplied data should format it through this rather than interpolate
 * the raw value.
 */
export function formatValue(value) {
  if (value === null || value === undefined || value === "") {
    const span = document.createElement("span");
    span.className = "data-empty";
    span.textContent = "—";
    span.setAttribute("aria-label", "sin dato");
    return span;
  }
  return document.createTextNode(String(value));
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
