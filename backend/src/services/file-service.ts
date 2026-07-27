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

/**
 * Releases a confirmed file to the patient.
 *
 * A record may hold many files but only one published at a time, so this
 * refuses while another is published and names it, rather than quietly
 * revoking it. Replacing a released result is a decision, and a manager
 * should have to make it on purpose: pass supersedes to do both atomically.
 */
export async function publish(
  db: D1Database,
  input: {
    fileId: string;
    actorEmail: string;
    /** File id of the published result this one replaces. */
    supersedes?: string;
    reason?: string | null;
  },
) {
  const current = await filesRepo.findStatus(db, input.fileId);

  if (!current) {
    throw new AppError("NOT_FOUND", "No encontramos el archivo.");
  }

  if (!isFileStatus(current.status) || !canTransition(current.status, "PUBLISHED")) {
    throw new AppError(
      "INVALID_TRANSITION",
      "Solo se puede publicar un archivo confirmado.",
      { currentStatus: current.status },
    );
  }

  const published = await filesRepo.findPublished(db, current.record_id);

  if (published && published.file_id !== input.supersedes) {
    throw new AppError(
      "ALREADY_PUBLISHED",
      "Este registro ya tiene un archivo publicado.",
      {
        currentFileId: published.file_id,
        currentFilename: published.original_filename,
      },
    );
  }

  if (input.supersedes) {
    if (!published) {
      throw new AppError(
        "INVALID_TRANSITION",
        "El archivo que intentas reemplazar ya no está publicado.",
      );
    }

    // One batch, so the record never has two published files or none.
    const [revoked, promoted] = await filesRepo.supersede(db, {
      currentFileId: input.supersedes,
      nextFileId: input.fileId,
      actorEmail: input.actorEmail,
      reason: input.reason ?? null,
    });

    if (revoked.meta.changes === 0 || promoted.meta.changes === 0) {
      throw new AppError(
        "INVALID_TRANSITION",
        "No se pudo reemplazar el archivo publicado.",
      );
    }

    return { recordId: current.record_id, superseded: input.supersedes };
  }

  const result = await filesRepo.publish(db, input.fileId, input.actorEmail);

  if (result.meta.changes === 0) {
    throw new AppError(
      "INVALID_TRANSITION",
      "Solo se puede publicar un archivo confirmado.",
    );
  }

  return { recordId: current.record_id, superseded: null };
}

/**
 * Withdraws a published file from the patient. Terminal: a revoked file is
 * never published again, so correcting one means uploading a new file. That
 * keeps published_at and revoked_at unambiguous, which a re-publishable
 * state would not.
 */
export async function revoke(
  db: D1Database,
  input: { fileId: string; actorEmail: string; reason: string | null },
) {
  return transition(db, {
    fileId: input.fileId,
    to: "REVOKED",
    apply: () => filesRepo.revoke(db, input.fileId, input.actorEmail, input.reason),
    rejection: "Solo se puede revocar un archivo publicado.",
  });
}
