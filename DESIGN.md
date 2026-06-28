---
name: dúolab
description: Conversion landing page for a clinical analysis lab — calm authority, warm purple, no institutional cold.
colors:
  morado-principal: "#6B4A8E"
  morado-oscuro: "#4A3163"
  lila-medio: "#B89DCE"
  lila-claro: "#EDE8F5"
  carbon: "#142129"
  gris-texto: "#5A6472"
  fondo-suave: "#F5F3F8"
  blanco: "#FFFFFF"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 3.5rem)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2rem)"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "8px"
  md: "12px"
  lg: "20px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "48px"
  xl: "96px"
components:
  button-primary:
    backgroundColor: "{colors.morado-principal}"
    textColor: "{colors.blanco}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "16px 32px"
  button-primary-hover:
    backgroundColor: "{colors.morado-oscuro}"
  button-secondary:
    backgroundColor: "{colors.blanco}"
    textColor: "{colors.morado-principal}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "16px 32px"
  card:
    backgroundColor: "{colors.lila-claro}"
    textColor: "{colors.carbon}"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: dúolab

## 1. Overview

**Creative North Star: "The Calm Specialist"**

dúolab is a clinical analysis lab talking to a parent who is already a little anxious. The system's job is to read as confident and capable without ever sounding like a hospital form letter. Authority comes from the brand's own deep purple (#6B4A8E) and from precision in layout and copy, not from clinical white-and-blue sterility or dense data displays. Warmth comes from soft lila/white grounds, generous spacing, and one consistent voice: cercano, claro, profesional, tranquilizador.

This system explicitly rejects: cold institutional hospital-site language and visuals; generic AI-template SaaS landing pages (gradient-to-blue heroes, gradient text, identical icon-card grids, hero-metric blocks, tiny uppercase tracked eyebrows, numbered section scaffolding, decorative glassmorphism); and stock-photo sterility in place of concrete, specific trust signals.

**Key Characteristics:**
- One saturated brand purple carries authority; everything else stays quiet around it.
- Generous whitespace and soft lila grounds, never sharp clinical white-on-white.
- A single typeface (Plus Jakarta Sans) doing all the work through weight, not mixed fonts.
- Pill-shaped, unmistakably tappable CTAs — there is exactly one action on this page and it should never be ambiguous.
- Calm pacing: no urgency tactics, no countdown energy, no aggressive motion.

## 2. Colors

A **Committed** strategy: the brand's own purple carries 30–60% of any given section, surrounded by soft neutrals that never compete with it.

### Primary
- **Morado Principal** (#6B4A8E): The dominant color — primary CTA buttons, header/nav accents, links, the one color a visitor remembers leaving the page.
- **Morado Oscuro** (#4A3163): Emphasis and contrast — button hover/active states, dark section backgrounds when a section needs to feel grounded (e.g. final CTA), and any text set directly on a light lila background that needs more weight than the body gris.

### Secondary
- **Lila Medio** (#B89DCE): Secondary accents — links and icons on light backgrounds, badges, decorative underlines. Never used for body text (insufficient contrast).

### Neutral
- **Lila Claro** (#EDE8F5): Card and section backgrounds — the default "soft" surface for the differentiator section (experience with children) and feature cards.
- **Fondo Suave** (#F5F3F8): Section background alternate — use to separate adjacent sections without a hard edge.
- **Blanco** (#FFFFFF): Page background and breathing room between sections.
- **Carbón** (#142129): Primary text — headlines and body copy on light backgrounds. Default ink color.
- **Gris Texto** (#5A6472): Secondary text — captions, metadata, supporting subheadlines. Verify this still hits ≥4.5:1 against whatever background it sits on; on Lila Claro it is borderline, so prefer Carbón at reduced weight over Gris Texto when the background is tinted.

### Named Rules
**The One Purple Rule.** Morado Principal is the only saturated color on the page. Lila Medio and Lila Claro are tints of the same hue, not competing accents — there is no second "brand color."

**The No Cold-White Rule.** Don't default every section to pure white. Alternate Blanco with Fondo Suave or Lila Claro so the page has rhythm instead of reading like a clinical waiting room.

## 3. Typography

**Display Font:** Plus Jakarta Sans (with system-ui, sans-serif fallback)
**Body Font:** Plus Jakarta Sans (with system-ui, sans-serif fallback)

**Character:** One typeface across the whole page, modern and accessible without losing warmth — per the brand guide, hierarchy is carried entirely by weight (ExtraBold 800 down to Light 300), never by mixing families.

### Hierarchy
- **Display** (800, clamp(2.25rem, 5vw, 3.5rem), 1.1, -0.02em): The hero H1. Used once — this is the lab name / hero headline, the approved copy verbatim, nothing competing for attention in the same viewport.
- **Headline** (700, clamp(1.5rem, 3vw, 2rem), 1.2): Section headings (problem, solution, social proof, final CTA).
- **Title** (600, 1.25rem, 1.3): Subtitles and card headings within a section.
- **Body** (400, 1rem, 1.6, max 65–75ch): Paragraph copy. Medium (500) for emphasis within body text, never a color change alone to convey emphasis.
- **Label** (500, 0.875rem, 1.4): Labels, captions, metadata, and CTA button text.

### Named Rules
**The Weight-Not-Width Rule.** Hierarchy is built by moving up and down the Plus Jakarta Sans weight scale (300–800), never by introducing a second font family. If a second font feels necessary, that's a sign the hierarchy plan is wrong, not the typeface.

## 4. Elevation

Flat by default, tonal layering for depth. dúolab does not use drop shadows as a default surface treatment — heavy shadows read as generic SaaS dashboard, and this page's depth comes from background tint changes (Blanco → Fondo Suave → Lila Claro) rather than shadow stacking. Shadows appear only as a direct response to interaction (hover/focus on the CTA button), never as resting-state decoration on cards.

### Shadow Vocabulary
- **CTA hover** (`box-shadow: 0 8px 24px oklch(35% 0.08 295 / 0.25)`): A soft, purple-tinted lift on the primary WhatsApp button when hovered or focused — confirms tappability without looking like a floating dashboard widget.

### Named Rules
**The Tint-Not-Shadow Rule.** Depth between sections comes from alternating background tints (Blanco / Fondo Suave / Lila Claro), not from box-shadows on cards. A card at rest has no shadow.

## 5. Components

### Buttons
- **Shape:** Pill (999px radius) — unmistakably tappable, never a sharp-cornered rectangle that could be mistaken for a static label.
- **Primary:** Morado Principal background, Blanco text, Label typography, 16px/32px padding. This is the WhatsApp CTA, repeated identically every time it appears.
- **Hover / Focus:** Background shifts to Morado Oscuro; soft purple-tinted shadow lift (see Elevation); transition under 200ms, ease-out, no bounce.
- **Secondary:** Blanco background, Morado Principal text and border — used for "Ver cómo llegar" (Google Maps) where the primary CTA is the WhatsApp button elsewhere in the same section.

### Cards
- **Corner Style:** 20px radius (`rounded.lg`) — soft enough to feel calm, not so round it feels playful/childish.
- **Background:** Lila Claro by default; switch to Blanco only when the card sits directly on a Lila Claro or Fondo Suave section (alternation, never two adjacent identical surfaces).
- **Shadow Strategy:** None at rest, per Elevation's Tint-Not-Shadow Rule.
- **Border:** None. Separation comes from the background tint difference with the section behind it, not a stroke.
- **Internal Padding:** 24px (`spacing.md`).

### Navigation
A minimal sticky header: logo left, single WhatsApp CTA (pill, Morado Principal) right — no multi-item nav menu, since this is a single-page conversion landing, not a multi-section site. On scroll, the header may gain a subtle Fondo Suave background instead of a shadow, consistent with the Tint-Not-Shadow Rule.

### Differentiator Section (signature)
The "experience with children" section is the page's strongest decision driver per PRODUCT.md and gets its own visual treatment, not just a bullet in a feature list: Lila Claro background, Title-weight heading, supporting body copy written in the parent's own words (per branding.md's voice examples), and its own WhatsApp CTA with a context-specific prefilled message. It should feel like a distinct moment in the scroll, not a card in a grid of equal-weight cards.

## 6. Do's and Don'ts

### Do:
- **Do** keep Morado Principal as the only saturated color on the page (The One Purple Rule).
- **Do** alternate Blanco / Fondo Suave / Lila Claro across sections for rhythm instead of an all-white page.
- **Do** use pill-shaped buttons (999px) for every CTA, identical in shape and color everywhere they appear.
- **Do** carry hierarchy through Plus Jakarta Sans weight (300–800) alone.
- **Do** give the children-experience section distinct visual weight (its own background block and CTA), per PRODUCT.md.
- **Do** write copy in the visitor's own language ("¿son buenos con niños?") rather than institutional phrasing.

### Don't:
- **Don't** use generic AI-template SaaS patterns: gradient-to-blue heroes, gradient text (`background-clip: text` + gradient), identical icon-card grids, hero-metric blocks, tiny uppercase tracked eyebrows, numbered section markers (01/02/03) as default scaffolding, or decorative glassmorphism.
- **Don't** add drop shadows to cards at rest — depth comes from background tint, not shadow (The Tint-Not-Shadow Rule).
- **Don't** introduce a second font family; if hierarchy feels insufficient, move up/down the weight scale instead.
- **Don't** use Gris Texto (#5A6472) body text on Lila Claro or Fondo Suave without checking contrast — default to Carbón when in doubt.
- **Don't** use cold institutional language, medical jargon, the word "Contáctenos," or any mention of insurance/IMSS (none of these arrangements exist) — per PRODUCT.md anti-references.
- **Don't** fill the social-proof section with generic or placeholder testimonials; use only verified quantitative trust signals until real reviews are sourced.
- **Don't** use bounce/elastic easing on the CTA hover — ease-out only, calm and immediate.
