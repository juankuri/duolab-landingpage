/**
 * The result file state machine.
 *
 *                  confirm            publish           revoke
 *     UPLOADED ─────────────> CONFIRMED ────────> PUBLISHED ────────> REVOKED
 *         ^                       │       ↖           (terminal)
 *         └────── withdraw ───────┘ ────── replace ──────┘
 *   delete allowed here only
 *
 * UPLOADED   an employee attached the PDF; nobody has vouched for it.
 * CONFIRMED  an employee reviewed it; ready for managerial validation.
 * PUBLISHED  a manager released it; this is the only state a patient can see.
 * REVOKED    a file was withdrawn; terminal, correcting means a new upload.
 *
 * Two cycles land back on UPLOADED, and both stay deliberate exceptions
 * rather than the norm: CONFIRMED -> UPLOADED ("withdraw") is confined to
 * the pre-publication half, where nothing was ever visible to a patient.
 * PUBLISHED -> UPLOADED ("replace") is the one case allowed to reach back
 * from the patient-visible half — swapping in a corrected PDF puts the
 * result through review and publication again rather than resurrecting the
 * old file, and canReplace() below governs it separately from this table
 * because it is not really "the same transition" as withdraw: it also
 * clears published_by/published_at, not just confirmed_by/confirmed_at (see
 * files.repo.ts's replace()), and DEC-014 makes its ordering — D1 before
 * R2 — load-bearing rather than incidental.
 *
 * REVOKED remains terminal for the revoke path specifically: a file a
 * manager or employee revoked outright (not replaced) cannot be published
 * again. Correcting a mistake there still means uploading and confirming a
 * new file.
 *
 * Known cost of the withdraw cycle, worth stating rather than discovering
 * later: confirming, withdrawing and confirming again overwrites
 * confirmed_by and confirmed_at, so only the last confirmation survives.
 * That is acceptable while nothing here was patient-visible. It stops being
 * acceptable the day someone has to answer who vouched for what and when,
 * which is the point at which an append-only events table earns its place.
 *
 * The values are constrained by a CHECK in database/migrations/0002_records.sql
 * as well. That bounds the set; this bounds the moves between them.
 */
export const FILE_STATUSES = [
  "UPLOADED",
  "CONFIRMED",
  "PUBLISHED",
  "REVOKED",
] as const;

export type FileStatus = (typeof FILE_STATUSES)[number];

/**
 * State-only moves — confirm, withdraw, publish, revoke — each a no-body
 * POST that flips a status and nothing else. `canTransition()` governs
 * exactly these four, via the shared `transition()` guard in
 * services/file-service.ts.
 *
 * Replace is deliberately NOT here even though it also ends at UPLOADED
 * from PUBLISHED (see the diagram above): it carries a new PDF, resets more
 * columns than withdraw does (published_by/at, not just confirmed_by/at),
 * and its D1-before-R2 ordering is load-bearing (DEC-014) in a way no move
 * in this table needs to be. Folding it in here would make canTransition()
 * report a move that no endpoint actually performs that way — `/withdraw`
 * only ever reads a CONFIRMED row, never a PUBLISHED one. canReplace()
 * below is its own, separate predicate for exactly that reason.
 */
const TRANSITIONS: Record<FileStatus, readonly FileStatus[]> = {
  UPLOADED: ["CONFIRMED"],
  // UPLOADED here is withdraw: an employee un-vouching for a file they
  // confirmed by mistake, so it can be replaced or removed.
  CONFIRMED: ["PUBLISHED", "UPLOADED"],
  PUBLISHED: ["REVOKED"],
  REVOKED: [],
};

export function isFileStatus(value: unknown): value is FileStatus {
  return (
    typeof value === "string" && FILE_STATUSES.includes(value as FileStatus)
  );
}

export function canTransition(from: FileStatus, to: FileStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Only an unvouched-for file may be removed outright.
 *
 * A CONFIRMED file has to be withdrawn first. That is one extra deliberate
 * step rather than a safety net, but it is the difference between deleting
 * something and deleting something an employee had put their name to.
 * PUBLISHED and REVOKED are never removed: after publication the record of
 * what a patient could see is the point.
 */
const DELETABLE: ReadonlySet<FileStatus> = new Set(["UPLOADED"]);

export function canDelete(status: FileStatus): boolean {
  return DELETABLE.has(status);
}

/**
 * A result's PDF may be swapped out from any of these three states — the
 * one action available regardless of how far a mistake got before it was
 * noticed. Not REVOKED: a revoked file is terminal by design (see the
 * module comment above); correcting it means a fresh upload; and not by
 * accident either — canTransition("REVOKED", "UPLOADED") is false, so the
 * two checks agree.
 */
const REPLACEABLE: ReadonlySet<FileStatus> = new Set([
  "UPLOADED",
  "CONFIRMED",
  "PUBLISHED",
]);

export function canReplace(status: FileStatus): boolean {
  return REPLACEABLE.has(status);
}
