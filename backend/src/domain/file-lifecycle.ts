/**
 * The result file state machine.
 *
 *                  confirm            publish           revoke
 *     UPLOADED ─────────────> CONFIRMED ────────> PUBLISHED ────────> REVOKED
 *                                                                    (terminal)
 *
 * UPLOADED   an employee attached the PDF; nobody has vouched for it.
 * CONFIRMED  an employee reviewed it; ready for managerial validation.
 * PUBLISHED  a manager released it; this is the only state a patient can see.
 * REVOKED    a manager withdrew it; terminal, correcting means a new upload.
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
  CONFIRMED: ["PUBLISHED"],
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
 * Statuses whose file may be removed outright. Publication is the line: once a
 * patient could have seen a file, it is withdrawn rather than erased.
 */
const DELETABLE: readonly FileStatus[] = ["UPLOADED", "CONFIRMED"];

export function canDelete(status: FileStatus): boolean {
  return DELETABLE.includes(status);
}
