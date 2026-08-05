/**
 * Build-time feature flags. There is exactly one, and it has an expiry date.
 *
 * LEGAL_ENABLED — /aviso-de-privacidad and /terminos-de-uso currently carry
 * [PENDIENTE] placeholder bodies. A placeholder privacy notice served from the
 * production origin is worse than no page at all, so those routes must be
 * unreachable there: not indexed, not linked, not built.
 *
 * `noindex` is not the mechanism. It is a request to crawlers, not access
 * control, and it does nothing about someone typing the URL. The mechanism is
 * this flag: astro.config.mjs only injects the two routes when it is on, and
 * PublicFooter.astro only renders the Legal column when it is on.
 *
 * Off unless the build is explicitly told "1", so forgetting the flag fails
 * safe (pages absent) rather than unsafe (placeholders live). deploy:staging
 * sets it; deploy:production does not.
 *
 * DELETE THIS FILE, and the injectRoute block in astro.config.mjs, in the same
 * commit that lands the approved legal copy. It is scaffolding, not a setting.
 */
export const LEGAL_ENABLED = import.meta.env.LEGAL_ENABLED === "1";
