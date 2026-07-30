import { parseMoment } from "./render.js";

/**
 * The pure logic behind /admin/manager's queue, batch rhythm and error
 * recovery — the DOM/fetch side lives in manager.astro's script, same split
 * as every other page in this module.
 */

/** Tab id -> the file status it queries and its label, in display order. */
export const TABS = [
  { id: "pending", status: "CONFIRMED", label: "Por publicar" },
  { id: "published", status: "PUBLISHED", label: "Publicados" },
  { id: "revoked", status: "REVOKED", label: "Revocados" },
];

export function tabLabel(tabId) {
  return TABS.find((tab) => tab.id === tabId)?.label ?? "";
}

export function statusForTab(tabId) {
  return TABS.find((tab) => tab.id === tabId)?.status;
}

/**
 * Flattens a `GET /records?include=files&status=<S>` response into one row
 * per actionable file — the manager queue never shows a folio, it shows the
 * result inside it. A record can come back with `files` filtered to the
 * requested status (see the backend's own comment on why); a record with no
 * matching file at all (missing `files` key, or an empty array) contributes
 * nothing rather than a broken row.
 */
export function queueItems(records, status) {
  const items = [];

  for (const record of records ?? []) {
    for (const file of record.files ?? []) {
      if (status && file.status !== status) continue;

      items.push({
        recordId: record.recordId,
        folio: record.folio,
        patientName: record.patientName,
        fileId: file.fileId,
        originalFilename: file.originalFilename,
        status: file.status,
        sequence: file.sequence,
        uploadedAt: file.uploadedAt,
        previewUrl: file.previewUrl,
      });
    }
  }

  return items;
}

/**
 * The batch-review pick: the first CONFIRMED item that is not the one just
 * published, or `null` when nothing is left. `remaining` excludes it too,
 * so "Ver siguiente (N)" and "no queda nada" agree with each other.
 */
export function nextPending(pendingItems, justPublishedRecordId) {
  const rest = (pendingItems ?? []).filter(
    (item) => item.recordId !== justPublishedRecordId,
  );

  if (rest.length === 0) return null;

  const [next] = rest;
  return { recordId: next.recordId, fileId: next.fileId, remaining: rest.length };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dayLabel(date, now) {
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(date)) / DAY_MS);
  const short = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(date);

  if (diffDays === 0) return `Hoy · ${short}`;
  if (diffDays === 1) return `Ayer · ${short}`;

  const weekday = new Intl.DateTimeFormat("es-MX", { weekday: "short" }).format(date);
  return `${weekday} ${short}`;
}

function hourLabel(date) {
  return `${String(date.getHours()).padStart(2, "0")}:00`;
}

/**
 * Groups queue items (see `queueItems`) into the day → hour structure M1/M2
 * of the manager wireframes: the hour is shown once as a heading rather than
 * repeated on every card. Both levels sort most-recent-first — the manager
 * wants the latest thing on top. Items with no parseable `uploadedAt` land
 * in a trailing "Sin fecha" group instead of being dropped.
 */
export function groupQueue(items, now = new Date()) {
  const dated = [];
  const undated = [];

  for (const item of items ?? []) {
    const date = parseMoment(item.uploadedAt);
    if (date) dated.push({ item, date });
    else undated.push(item);
  }

  const days = new Map(); // dayKey -> { dayLabel, hours: Map<hourKey, {hourLabel, items[]}> }

  for (const { item, date } of dated) {
    const dKey = dayKey(date);
    if (!days.has(dKey)) {
      days.set(dKey, { dayKey: dKey, dayLabel: dayLabel(date, now), hours: new Map() });
    }
    const day = days.get(dKey);

    const hKey = hourLabel(date);
    if (!day.hours.has(hKey)) day.hours.set(hKey, { hourLabel: hKey, items: [] });
    day.hours.get(hKey).items.push(item);
  }

  const groups = [...days.values()]
    .sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1))
    .map((day) => ({
      dayKey: day.dayKey,
      dayLabel: day.dayLabel,
      hours: [...day.hours.values()].sort((a, b) => (a.hourLabel < b.hourLabel ? 1 : -1)),
    }));

  if (undated.length > 0) {
    groups.push({
      dayKey: "sin-fecha",
      dayLabel: "Sin fecha",
      hours: [{ hourLabel: "", items: undated }],
    });
  }

  return groups;
}

/**
 * A 409 INVALID_TRANSITION here means someone else already moved this file
 * (confirmed a withdraw, published it, revoked it) between the queue being
 * read and the tap landing. `details.currentStatus` names what it is now.
 */
export function transitionConflictMessage(payload, labelOf) {
  const current = payload?.details?.currentStatus;
  const label = current ? labelOf(current) : "otro estado";
  return `Otra persona ya cambió este resultado (ahora: ${label}).`;
}

/**
 * REVOKED is terminal (DEC-007/DEC-014) — this is the one piece of copy
 * that must never again say a revoked file can be republished, which is
 * exactly what the prototype (docs/upload-pdf-feature.html) got wrong.
 */
export function revokeConfirmBody({ patientName, folio }) {
  return (
    `${patientName} · ${folio}. El paciente dejará de verlo y descargarlo de inmediato. ` +
    "Esto es definitivo: este archivo no se puede volver a publicar. Si necesitas " +
    "corregirlo, recepción debe subir un resultado nuevo."
  );
}

export function revokedExplanation({ revokedBy, revokedAt, formatMoment }) {
  const when = revokedAt ? formatMoment(revokedAt) : "";
  const who = revokedBy ? ` por ${revokedBy}` : "";
  return (
    `Revocado el ${when}${who}. Un resultado revocado no puede volver a publicarse; ` +
    "para corregirlo, sube un resultado nuevo desde recepción."
  );
}
