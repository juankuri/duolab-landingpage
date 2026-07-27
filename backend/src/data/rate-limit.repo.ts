// All SQL touching public_lookup_attempts.

/**
 * Increments the counter for (fingerprint, windowStart) and returns the
 * post-increment count, in one statement. A SELECT-then-UPDATE from
 * application code would race under concurrent requests — two requests could
 * both read count=4, both write count=5, and the limit would never trip.
 * INSERT .. ON CONFLICT DO UPDATE .. RETURNING is atomic in SQLite, so the
 * increment and the read-back happen as a single indivisible step.
 */
export async function incrementAndCheck(
  db: D1Database,
  fingerprint: string,
  windowStart: string,
  limit: number,
): Promise<{ allowed: boolean; count: number }> {
  const row = await db
    .prepare(
      `INSERT INTO public_lookup_attempts (fingerprint, window_start, count)
       VALUES (?, ?, 1)
       ON CONFLICT (fingerprint, window_start)
         DO UPDATE SET count = count + 1
       RETURNING count`,
    )
    .bind(fingerprint, windowStart)
    .first<{ count: number }>();

  const count = row?.count ?? 1;

  return { allowed: count <= limit, count };
}
