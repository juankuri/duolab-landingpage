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
