/**
 * The whole icon set the admin/patient surfaces need — stroked, currentColor,
 * 24x24 viewBox, matching the conventions LinkButton.astro/WhatsAppButton.astro
 * already use on the landing (stroke-width 1.75, aria-hidden, focusable="false").
 *
 * Deliberately not an icon library: 8 glyphs, hand-written, no dependency.
 * Every use of one of these is required to sit beside a visible text label
 * (requirement 4) — this file has no opinion on that, Icon.astro's callers do.
 */
export const ICONS = {
  upload:
    '<path d="M12 16V4M12 4l-4 4M12 4l4 4M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />',
  download:
    '<path d="M12 4v12M12 16l-4-4M12 16l4-4M5 18v0a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v0" />',
  "external-link":
    '<path d="M14 5h5v5M19 5l-8 8M8 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2" />',
  phone:
    '<path d="M6 3h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2C10.6 19 5 13.4 5 6a2 2 0 0 1 1-3z" />',
  calendar:
    '<path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />',
  folio: '<path d="M9 3h6l3 3v15H6V3z" /><path d="M9 12h6M9 16h6" />',
  person:
    '<circle cx="12" cy="8" r="3.25" /><path d="M5 20c1.2-4 4-6 7-6s5.8 2 7 6" />',
  chevron: '<path d="M9 6l6 6-6 6" />',
};

export const ICON_NAMES = Object.keys(ICONS);
