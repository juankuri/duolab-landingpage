import * as filesRepo from "../data/files.repo";
import * as storage from "../data/storage";
import { AppError, logEvent } from "../domain/errors";
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
    throw new AppError("NOT_FOUND", "File not found.");
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
