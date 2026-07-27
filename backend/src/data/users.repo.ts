import type { Role } from "../domain/roles";

export type UserRow = {
  email: string;
  role: string;
  active: number;
};

/**
 * Callers must pass an already-normalized address. The column is NOCASE and
 * the schema has a CHECK enforcing lowercase, but normalizing in the
 * application is the control that actually holds, because NOCASE folds ASCII
 * only.
 */
export function findByEmail(db: D1Database, email: string) {
  return db
    .prepare("SELECT email, role, active FROM users WHERE email = ?")
    .bind(email)
    .first<UserRow>();
}

export function upsert(
  db: D1Database,
  user: { email: string; role: Role; active?: boolean },
) {
  return db
    .prepare(
      `INSERT INTO users (email, role, active) VALUES (?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET role = excluded.role, active = excluded.active`,
    )
    .bind(user.email, user.role, user.active === false ? 0 : 1)
    .run();
}
