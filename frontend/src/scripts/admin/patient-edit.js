/**
 * Pure rules for the /admin/paciente inline edit panel — kept separate from
 * the page's DOM wiring so they can be tested without a browser environment.
 *
 * Phone and birth date are two of the three public-lookup authentication
 * factors (services/public-result-service.ts); editing either re-keys who
 * can download this patient's already-published results, which is why they
 * (and only they) require the consequence confirmation before saving.
 */

export const AUTH_FACTOR_FIELDS = ["phoneNumber", "birthDate"];

/**
 * Compares validated field values against the patient's current ones and
 * returns only what actually changed — a PATCH with an empty body is not a
 * valid request, and re-sending an unchanged value would recompute
 * search_name on the server for nothing.
 */
export function diffPatientChanges(current, next) {
  const changes = {};

  for (const field of ["fullName", "phoneNumber", "birthDate"]) {
    if (next[field] !== undefined && next[field] !== current[field]) {
      changes[field] = next[field];
    }
  }

  return changes;
}

/** Whether a set of changes touches a public-lookup authentication factor. */
export function needsConsequenceConfirmation(changes) {
  return AUTH_FACTOR_FIELDS.some((field) => field in changes);
}
