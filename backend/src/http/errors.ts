import type { Context, ErrorHandler } from "hono";

import { AppError, logEvent } from "../domain/errors";
import type { AppEnv } from "../env";

/**
 * Every response that reports a failure carries the same request id that the
 * server logged, so a staff member reading "Ref: a1b2c3d4" off the screen
 * gives you the exact line to grep for. Without it the only way to connect a
 * report to a log entry is a guess about timing.
 */
export function requestId(c: Context<AppEnv>): string {
  return c.get("requestId");
}

export const onError: ErrorHandler<AppEnv> = (error, c) => {
  const id = requestId(c);

  if (error instanceof AppError) {
    // Expected failures: the caller did something the API refuses. Logged at
    // a glance-able level with no stack, since nothing is wrong with the
    // server.
    logEvent("REQUEST_REJECTED", {
      requestId: id,
      code: error.code,
      status: error.httpStatus,
      path: c.req.path,
    });

    return c.json(
      { error: error.message, code: error.code, requestId: id, ...error.details },
      error.httpStatus,
    );
  }

  logEvent("REQUEST_FAILED", {
    requestId: id,
    path: c.req.path,
    message: error instanceof Error ? error.message : String(error),
  });
  console.error(error);

  // Deliberately generic. The cause is in the logs, not in the response: a
  // stack trace or a driver message here would describe the schema to anyone
  // able to trigger a fault.
  return c.json(
    { error: "Something went wrong.", code: "INTERNAL", requestId: id },
    500,
  );
};
