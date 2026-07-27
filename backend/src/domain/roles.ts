export const ROLES = ["EMPLOYEE", "MANAGER"] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value as Role);
}

/**
 * MANAGER is a strict superset of EMPLOYEE: everything an employee may do, a
 * manager may do, plus publish and revoke.
 *
 * Chosen deliberately, with the cost acknowledged rather than overlooked: it
 * means no separation of duties. One manager can create a record, upload the
 * PDF, confirm it and publish it with nobody else involved.
 *
 * The alternative — a manager who may only review and release — enforces four
 * eyes structurally, but deadlocks a lab this size the moment the manager is
 * the only person present. confirmed_by and published_by are both recorded, so
 * a rule requiring them to differ can be added later as a guard, without a
 * migration and without revisiting this decision from scratch.
 */
export function satisfies(actual: Role, required: Role): boolean {
  if (required === "EMPLOYEE") {
    return actual === "EMPLOYEE" || actual === "MANAGER";
  }

  return actual === required;
}
