import { AppError } from "../domain/errors";
import { encryptToken } from "../domain/download-token";
import { maskPatientName } from "../domain/masking";
import { timingSafeEqual } from "../domain/public-verification";
import {
  validateBirthDate,
  validateFolio,
  validatePhoneNumber,
} from "../domain/validation";
import * as filesRepo from "../data/files.repo";
import * as recordsRepo from "../data/records.repo";
import { checkPublicLookupRateLimit } from "./rate-limiter";
import type { AppContext } from "../env";

const TOKEN_TTL_MS = 5 * 60 * 1000;

// Best-effort shape used only to key the rate limiter, applied before real
// validation. A malformed folio must still spend that folio-shaped
// fingerprint's budget — validating first and only rate-limiting valid
// input would let an attacker dodge the limiter by sending garbage.
function normalizeForFingerprint(raw: unknown): string {
  if (typeof raw !== "string") {
    return "";
  }
  return raw.trim().toUpperCase().slice(0, 32);
}

export type LookupInput = {
  folio: unknown;
  phone: unknown;
  birthDate: unknown;
};

export type LookupResult = {
  downloadToken: string;
  expiresAt: string;
  /** Given names in full, surnames as an initial — see domain/masking.ts.
   * Only ever present once folio + phone + birth date all matched. */
  patientDisplayName: string;
  /**
   * Every published study on the folio. Filename and publication date are
   * exposed so a patient holding several PDFs can tell them apart — with
   * three results in hand, an unlabelled list of download links is not
   * usable. Nothing here is returned before folio + phone + birth date all
   * match, so this widens what a *verified* patient sees, not what an
   * unverified caller can discover.
   */
  results: {
    fileId: string;
    filename: string;
    publishedAt: string;
  }[];
};

/**
 * Every failure branch below throws the same LOOKUP_FAILED AppError with no
 * distinguishing detail — bad shape, no such folio, wrong phone, wrong birth
 * date, no published file and a revoked file are all indistinguishable from
 * the response alone. Only the rate-limit branch, checked first, is allowed
 * to differ, because request volume isn't a privacy-sensitive signal the way
 * folio/phone/date correctness is.
 */
export async function lookupPublicResult(
  c: AppContext,
  input: LookupInput,
): Promise<LookupResult> {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const fingerprintFolio = normalizeForFingerprint(input.folio);

  const allowed = await checkPublicLookupRateLimit(
    c.env.DB,
    c.env.RATE_LIMIT_KEY_SECRET,
    ip,
    fingerprintFolio,
  );

  if (!allowed) {
    throw new AppError("RATE_LIMITED", "Demasiados intentos. Intenta más tarde.");
  }

  const fail = () =>
    new AppError("LOOKUP_FAILED", "No encontramos un resultado con esos datos.");

  const folio = validateFolio(input.folio);
  const phone = validatePhoneNumber(input.phone);
  const birthDate = validateBirthDate(input.birthDate);

  if (!folio.ok || !phone.ok || !birthDate.ok) {
    throw fail();
  }

  const record = await recordsRepo.findRecordDetail(c.env.DB, {
    by: "folio",
    value: folio.value,
  });

  // Constant-time comparisons against real-shaped placeholders even when no
  // record was found, so a missing record doesn't skip work a mismatched one
  // would have done — reduces, doesn't eliminate, the timing gap between
  // branches (the D1 round trip itself already dwarfs this).
  const phoneMatches = timingSafeEqual(phone.value, record?.phone_number ?? "");
  const birthDateMatches = timingSafeEqual(birthDate.value, record?.birth_date ?? "");

  if (!record || !phoneMatches || !birthDateMatches) {
    throw fail();
  }

  const published = await filesRepo.listPublished(c.env.DB, record.record_id);

  // A folio with nothing released yet fails exactly like a wrong folio,
  // a wrong phone or a wrong birth date. Multi-publish does not change
  // this: the count of published files is only ever revealed to a caller
  // who already matched all three verification factors.
  if (published.results.length === 0) {
    throw fail();
  }

  const exp = Date.now() + TOKEN_TTL_MS;
  const downloadToken = await encryptToken(c.env.DOWNLOAD_TOKEN_SECRET, {
    recordId: record.record_id,
    exp,
  });

  return {
    downloadToken,
    expiresAt: new Date(exp).toISOString(),
    patientDisplayName: maskPatientName(record.full_name),
    results: published.results.map((file) => ({
      fileId: file.file_id,
      filename: file.original_filename,
      publishedAt: file.published_at,
    })),
  };
}
