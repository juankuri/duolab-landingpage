import * as filesRepo from "../data/files.repo";
import * as recordsRepo from "../data/records.repo";
import * as storage from "../data/storage";
import { AppError, logEvent } from "../domain/errors";
import { canDelete, isFileStatus } from "../domain/file-lifecycle";
import type { Bindings } from "../env";

/**
 * Workers have no transaction spanning R2 and D1, so this is not atomic and
 * does not pretend to be. What it guarantees:
 *
 *   - if the metadata insert fails, the object just written is deleted, so a
 *     failed upload leaves nothing behind;
 *   - if that compensating delete ALSO fails, the object is orphaned. It is
 *     unreachable, since every read goes through a files row, and its key is
 *     deterministic, so the ORPHAN_R2_OBJECT log line is enough to remove it
 *     by hand. Storage cost is the only consequence.
 *
 * Object first, then metadata, so a visible row never points at bytes that
 * are not there. The reverse order trades an invisible orphan for a record
 * the UI renders and the preview 404s on, which is the worse failure.
 */
export async function uploadResult(
  env: Bindings,
  input: {
    recordId: string;
    file: File;
    uploadedBy: string;
    requestId: string;
  },
) {
  const fileId = crypto.randomUUID();
  const r2Key = storage.resultKey(input.recordId, fileId);

  await storage.putResult(env.RESULTS_BUCKET, r2Key, input.file, {
    recordId: input.recordId,
    fileId,
  });

  try {
    await filesRepo.insert(env.DB, {
      fileId,
      recordId: input.recordId,
      r2Key,
      originalFilename: input.file.name,
      mimeType: input.file.type,
      sizeBytes: input.file.size,
      uploadedBy: input.uploadedBy,
    });
  } catch (error) {
    await storage.deleteResult(env.RESULTS_BUCKET, r2Key).catch(() => {
      logEvent("ORPHAN_R2_OBJECT", {
        reason: "compensating delete failed after metadata insert failed",
        r2Key,
        recordId: input.recordId,
        fileId,
        requestId: input.requestId,
      });
    });

    throw error;
  }

  return { fileId, r2Key };
}

/**
 * Creates a patient (unless an existing `patientId` is supplied), a record,
 * and its first result, atomically-ish: the D1 batch is a real transaction,
 * so patient + record + file either all land or none do. R2 is not part of
 * that transaction — same bounded guarantee as uploadResult() above, object
 * first so a row is never visible before its bytes are, compensating delete
 * on any D1 failure. A folio can no longer exist without a result; this is
 * the only path that creates a record row.
 */
export async function createWithFirstResult(
  env: Bindings,
  input: {
    patientId?: string;
    fullName?: string;
    birthDate?: string;
    phoneNumber?: string;
    folio: string;
    file: File;
    uploadedBy: string;
    requestId: string;
  },
) {
  let patient: { patientId: string; fullName: string; birthDate: string; phoneNumber: string } | undefined;

  if (input.patientId) {
    const existing = await recordsRepo.findPatient(env.DB, input.patientId);

    if (!existing) {
      throw new AppError("NOT_FOUND", "No encontramos al paciente.");
    }
  } else {
    // Fields are validated by the caller before this runs (see
    // routes/records.ts), same as every other required-field endpoint.
    patient = {
      patientId: crypto.randomUUID(),
      fullName: input.fullName!,
      birthDate: input.birthDate!,
      phoneNumber: input.phoneNumber!,
    };
  }

  const patientId = patient?.patientId ?? input.patientId!;
  const recordId = crypto.randomUUID();
  const fileId = crypto.randomUUID();
  const r2Key = storage.resultKey(recordId, fileId);

  await storage.putResult(env.RESULTS_BUCKET, r2Key, input.file, { recordId, fileId });

  try {
    await recordsRepo.createRecordWithFile(env.DB, {
      patient,
      record: { recordId, folio: input.folio, patientId },
      file: {
        fileId,
        recordId,
        r2Key,
        originalFilename: input.file.name,
        mimeType: input.file.type,
        sizeBytes: input.file.size,
        uploadedBy: input.uploadedBy,
      },
    });
  } catch (error) {
    await storage.deleteResult(env.RESULTS_BUCKET, r2Key).catch(() => {
      logEvent("ORPHAN_R2_OBJECT", {
        reason: "compensating delete failed after atomic-create batch failed",
        r2Key,
        recordId,
        fileId,
        requestId: input.requestId,
      });
    });

    throw error;
  }

  return { recordId, patientId, fileId };
}

/**
 * Metadata first, then the object. If the object delete fails the row is
 * already gone, so nothing surfaces the missing bytes; the orphan is logged
 * and R2 deletes are idempotent, so removing it later is safe to retry.
 *
 * Doing it the other way round would risk a row whose object is missing,
 * which the UI shows as a file that cannot be previewed.
 */
export async function deleteResult(
  env: Bindings,
  input: { recordId: string; fileId: string; requestId: string },
) {
  const file = await filesRepo.findInRecord(env.DB, input.recordId, input.fileId);

  if (!file) {
    throw new AppError("NOT_FOUND", "No encontramos el archivo.");
  }

  if (!isFileStatus(file.status)) {
    throw new AppError("INTERNAL", "El archivo tiene un estado desconocido.");
  }

  // Deleting is only for a file nobody has vouched for yet. A confirmed file
  // has to be withdrawn first, and a published one is revoked rather than
  // erased, because what a patient could see is the thing worth keeping.
  if (!canDelete(file.status)) {
    throw new AppError(
      "INVALID_TRANSITION",
      file.status === "CONFIRMED"
        ? "Retira la confirmación antes de eliminar el archivo."
        : "Un archivo publicado no se elimina; revócalo.",
      { currentStatus: file.status },
    );
  }

  await filesRepo.remove(env.DB, input.fileId);

  await storage.deleteResult(env.RESULTS_BUCKET, file.r2_key).catch(() => {
    logEvent("ORPHAN_R2_OBJECT", {
      reason: "object delete failed after metadata was removed",
      r2Key: file.r2_key,
      recordId: input.recordId,
      fileId: input.fileId,
      requestId: input.requestId,
    });
  });
}
