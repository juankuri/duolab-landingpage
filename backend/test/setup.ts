import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, beforeEach } from "vitest";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

// Every test starts from an empty database and an empty bucket. Ordered
// child first so the ON DELETE RESTRICT foreign keys do not block the delete.
beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM files"),
    env.DB.prepare("DELETE FROM records"),
    env.DB.prepare("DELETE FROM patients"),
    env.DB.prepare("DELETE FROM public_lookup_attempts"),
  ]);

  const stored = await env.RESULTS_BUCKET.list();

  for (const object of stored.objects) {
    await env.RESULTS_BUCKET.delete(object.key);
  }
});
