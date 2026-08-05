// Masks a patient's full name for the public lookup response — given names
// in full, surnames reduced to an initial, so a patient who typed their own
// folio + phone + birth date sees a name they recognize as theirs without
// the full legal name ever crossing the public boundary
// (services/public-result-service.ts only calls this after all three
// factors match; see DEC-015's non-enumeration guardrail for why nothing
// here may run before that).
//
// "Given names" vs "surnames" is a guess, not a parse: Spanish naming
// convention in this lab's records is First [Middle] Paternal [Maternal],
// but nothing in `patients.full_name` marks where one ends and the other
// begins. The rule below assumes the LAST HALF of the words (rounded down)
// are surnames — for the common two-or-three-word case that already handles
// "Juan Pablo Kuri Ricardez" the way a person would read it. Getting this
// exactly right for every real name is not the goal; revealing meaningfully
// less than the full legal name to an unauthenticated party is.

/** "Juan Pablo Kuri Ricardez" -> "Juan Pablo K. R.". A single word is returned unchanged — there is no surname to mask, and initialing someone's only name would just be confusing. */
export function maskPatientName(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);

  if (words.length <= 1) {
    return fullName.trim();
  }

  const surnameCount = Math.max(1, Math.floor(words.length / 2));
  const givenCount = words.length - surnameCount;

  const given = words.slice(0, givenCount);
  const surnames = words.slice(givenCount).map((word) => `${word[0].toUpperCase()}.`);

  return [...given, ...surnames].join(" ");
}
