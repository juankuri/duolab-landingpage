/**
 * Error codes are part of the API contract: the admin UI branches on them,
 * where the human-readable message is only shown. Keeping the code and its
 * HTTP status together here is what stops the same condition from answering
 * 400 in one handler and 409 in another.
 */
export const ERROR_CODES = {
  INVALID_INPUT: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  FOLIO_CONFLICT: 409,
  INVALID_TRANSITION: 409,
  ALREADY_PUBLISHED: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INTERNAL: 500,
  // The one response for every public-lookup and public-download failure
  // that isn't rate limiting: bad input, no such folio, wrong phone, wrong
  // birth date, no published file, a revoked file, an invalid or expired
  // download token. Deliberately one code for all of them — see
  // docs/03-decisions.md on the public lookup for why.
  LOOKUP_FAILED: 404,
  RATE_LIMITED: 429,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export type HttpStatus = (typeof ERROR_CODES)[ErrorCode];

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: HttpStatus;
  /** Merged into the response body. For details the client can act on. */
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = ERROR_CODES[code];
    this.details = details;
  }
}

/**
 * Structured log line. Identifiers only, never patient data.
 *
 * These logs are operational telemetry, not a medical record: a name, a birth
 * date or a phone number in here would put patient data somewhere with a
 * different retention policy and a much wider audience than the database.
 * Log the recordId and look the rest up if it is genuinely needed.
 */
export function logEvent(
  event: string,
  fields: Record<string, string | number | undefined>,
) {
  console.error(JSON.stringify({ event, ...fields }));
}
