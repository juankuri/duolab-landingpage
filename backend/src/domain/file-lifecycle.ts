/**
 * The result file state machine.
 *
 *                  confirm            publish           revoke
 *     UPLOADED ─────────────> CONFIRMED ────────> PUBLISHED ────────> REVOKED
 *         ^                       │                                 (terminal)
 *         └────── withdraw ───────┘
 *   delete allowed here only
 *
 * UPLOADED   an employee attached the PDF; nobody has vouched for it.
 * CONFIRMED  an employee reviewed it; ready for managerial validation.
 * PUBLISHED  a manager released it; this is the only state a patient can see.
 * REVOKED    a manager withdrew it; terminal, correcting means a new upload.
 *
 * The one cycle is CONFIRMED -> UPLOADED, and it is deliberately confined to
 * the pre-publication half, where nothing was ever visible to a patient.
 * After publication the machine is strictly linear and ends at REVOKED, so
 * "was this ever released, and is it still" always has one answer.
 *
 * Known cost of that cycle, worth stating rather than discovering later:
 * confirming, withdrawing and confirming again overwrites confirmed_by and
 * confirmed_at, so only the last confirmation survives. That is acceptable
 * while nothing here was patient-visible. It stops being acceptable the day
 * someone has to answer who vouched for what and when, which is the point at
 * which an append-only events table earns its place.
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
