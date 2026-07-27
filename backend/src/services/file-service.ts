import * as filesRepo from "../data/files.repo";
import { AppError } from "../domain/errors";
import {
  type FileStatus,
  canTransition,
  isFileStatus,
} from "../domain/file-lifecycle";

/**
 * Every lifecycle move goes through here, so the guard is written once.
 *
 * Three layers protect a transition, and all three are load-bearing:
 *
 *   1. the CHECK constraint bounds which values can exist at all;
 *   2. this guard rejects a move the state machine does not allow, and can
 *      say what the current status is, which the database cannot;
 *   3. the UPDATE carries `AND status = ?`, so the database decides the
 *      outcome. Between the read below and that write, a concurrent request
 *      can win; a zero change count is how this one finds out.
 *
 * Reading first is what separates "no such file" from "wrong state". They
 * used to be the same 404.
 */
export async function transition(
  db: D1Database,
  input: {
    fileId: string;
    to: FileStatus;
    /** Runs the UPDATE. Must guard on the expected current status. */
    apply: (from: FileStatus) => Promise<D1Result>;
    /** Message when the move is not allowed from the current status. */
    rejection: string;
  },
) {
  const current = await filesRepo.findStatus(db, input.fileId);

  if (!current) {
    throw new AppError("NOT_FOUND", "No encontramos el archivo.");
  }

  if (!isFileStatus(current.status)) {
    // Only reachable if something wrote a status past the CHECK constraint.
    throw new AppError("INTERNAL", "El archivo tiene un estado desconocido.");
  }

  if (!canTransition(current.status, input.to)) {
    throw new AppError("INVALID_TRANSITION", input.rejection, {
      currentStatus: current.status,
    });
  }

  const result = await input.apply(current.status);

  if (result.meta.changes === 0) {
    throw new AppError("INVALID_TRANSITION", input.rejection, {
      currentStatus: current.status,
    });
  }

  return { recordId: current.record_id, from: current.status };
}
