# Feature Specification: DúoLab Conversion Landing Page

**Feature Branch**: `001-duolab-landing-page`

**Created**: 2026-06-27

**Status**: Draft

**Input**: User description: "Lee todos los documentos en /clientes/isabel/ (briefing.md, buyer-persona.md, branding.md, offer.md, copy.md). Con esa información, genera la especificación para una landing page de conversión. La landing debe: comunicar la propuesta de valor definida en la oferta; hablar directamente al buyer persona descrito; usar el tono y copy aprobados; seguir los lineamientos de branding; tener como objetivo principal 'Hablar con un especialista'; incluir las secciones hero, problema, solución, prueba social, CTA final."

## Clarifications

### Session 2026-06-27

- Q: Should the hero H1 be the exact approved text from copy.md verbatim, or can it be adapted during implementation? → A: Use the H1 from copy.md verbatim, word-for-word, no paraphrasing allowed.
- Q: What should happen in the "prueba social" section given no real DúoLab testimonial/review is sourced yet in the client docs? → A: Require real Google reviews/testimonials sourced from the client before launch; until sourced, ship with only quantitative trust signals (years, # of studies) — no placeholder quotes.

### Session 2026-06-28

- Q: copy.md frames itself as "el texto exacto" for every section, but FR-002 only locks the hero H1 as word-for-word verbatim, while FR-003/FR-004 describe other sections more loosely ("in the buyer persona's own language"). Is copy.md's text verbatim-required for every listed section, or only the hero H1? → A: copy.md's approved text is the verbatim source for every section it covers (eyebrow, CTA labels, trust-bar labels, FAQ answers, etc.), not just the hero H1. FR-003/FR-004's "buyer persona's own language" describes the *voice* copy.md already writes in, not license to rewrite it; implementers use copy.md text as-is and only adapt wording where copy.md is itself silent (e.g. dynamic data like a study count pulled from data-model.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mother with young children looking for a trustworthy lab (Priority: P1)

Carla lands on the page after searching "laboratorio de análisis Ciudad del Carmen" on Google, or because someone recommended it in a WhatsApp group. She brings concrete doubts: whether she needs an appointment, how much it will cost, and above all whether the staff knows how to handle her child, who is afraid of needles. She reads the page top to bottom looking for that reassurance before deciding to go, and ends up writing on WhatsApp to confirm she can bring her child.

**Why this priority**: This is the primary buyer persona identified in the research (buyer-persona.md), and the experience-with-children differentiator is, per offer.md, the business's strongest competitive advantage. If the page doesn't convert this persona, it fails its main purpose.

**Independent Test**: Can be tested by showing the page to a mother with young children and verifying that, without external help, she identifies that the lab has experience caring for children, that no appointment is needed, and that she knows how to contact a specialist via WhatsApp.

**Acceptance Scenarios**:

1. **Given** Carla opens the landing page on her phone, **When** she reviews the solution section, **Then** she finds an explicit, visible mention of experience taking samples from children before reaching the final CTA.
2. **Given** Carla has doubts about appointments and price, **When** she reads the problem section, **Then** she recognizes her own doubt reflected in the text (in her own language, not medical jargon).
3. **Given** Carla decides to contact the lab, **When** she taps the primary CTA button, **Then** WhatsApp opens with a prefilled message related to her question.

---

### User Story 2 - Adult who keeps putting off their health needs a quick resolution (Priority: P2)

Roberto comes because his doctor ordered studies and he wants to "get it over with" without wasting time. He doesn't want to ask too many questions: he wants to quickly know whether he can walk in without an appointment, how reliable the lab is, and how to contact them to confirm before going.

**Why this priority**: This is the secondary buyer persona (buyer-persona.md). Converting him is valuable but secondary to the experience-with-children differentiator, which is the main marketing angle.

**Independent Test**: Can be tested by showing the page to an adult without young children and verifying that he still finds, without feeling excluded by the children-focused messaging, the trust information (years of experience, no appointment needed, reliable results) and the CTA to talk to a specialist.

**Acceptance Scenarios**:

1. **Given** Roberto enters the page, **When** he reviews the social-proof section, **Then** he finds trust signals (years of experience, number of studies, same-day results) without needing to read the section dedicated to children.
2. **Given** Roberto wants to confirm before going, **When** he reaches the final CTA, **Then** he finds a clear, jargon-free message inviting him to talk to a specialist via WhatsApp.

---

### User Story 3 - Visitor comparing options before deciding looks for social validation (Priority: P3)

A visitor who found the lab on Google Maps or through a recommendation wants to confirm, before writing in, that other people have had good experiences and that the business is legitimate and established.

**Why this priority**: Reinforces the conversion decision but is not, on its own, sufficient to drive the primary action — it works in conjunction with the problem/solution sections.

**Independent Test**: Can be tested by verifying that a visitor, viewing only the social-proof section in isolation, can name at least two concrete trust signals about the lab (years of experience, number of studies, evidence of good treatment).

**Acceptance Scenarios**:

1. **Given** the visitor reaches the social-proof section, **When** they read it, **Then** they identify at least two concrete trust data points (for example: "11 años de experiencia", "+50 estudios disponibles").

---

### Edge Cases

- What happens if the visitor opens the page on a device without WhatsApp installed? The CTA must still work via WhatsApp Web.
- What happens if the visitor is the secondary buyer persona and the page overemphasizes the children-focused message? The children-focused section must be clearly delimited as its own section, without dominating the rest of the content or making someone without children feel excluded.
- What happens if the visitor arrives on a slow mobile connection? The essential content (value proposition and CTA) must be visible and usable before any secondary element loads.
- What happens if the lab's real WhatsApp number isn't available yet at publish time? The page must not be published with a placeholder number.
- What happens if no real reviews or testimonials from the lab are available yet at publish time? The social-proof section is published with only quantitative trust signals (years of operation, number of studies, turnaround time); it is not filled in with generic or unverified testimonials.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The landing page MUST include a "hero" section visible without scrolling that communicates, in one phrase, the offer's central value proposition (reliable results + human treatment) and MUST include the primary CTA in the same viewport.
- **FR-002**: The "hero" section MUST use, as its H1, the exact approved text from copy.md ("Tus análisis clínicos, con resultados en los que confías.") word for word, with no paraphrasing, along with a supporting subheadline, without mixing in multiple competing value propositions.
- **FR-003**: The landing page MUST include a "problem" section that names, in the buyer persona's own language (not medical or institutional jargon), the doubts and fears identified in the research: need for an appointment, price uncertainty, fear about how children will be treated, and distrust of results.
- **FR-004**: The landing page MUST include a "solution" section that presents the lab's offer (more than 50 types of studies, no-appointment service, prior guidance via WhatsApp, clear pricing from first contact) as a direct answer to each doubt raised in the "problem" section.
- **FR-005**: The "solution" section MUST give distinct visual and content prominence to the experience-with-children differentiator (experience taking samples from children), as it is the strongest decision factor identified for the primary buyer persona.
- **FR-006**: The landing page MUST include a "social proof" section showing verifiable trust signals: years of operation, number of types of studies available, and results turnaround time. If, by publish time, the client has already provided real and verifiable reviews or testimonials (e.g., screenshots or links to Google reviews), the section MUST include them. If they have not yet been obtained, the section MUST be published with only the quantitative trust signals — it MUST NOT include generic or unverified patient testimonials or quotes as filler.
- **FR-007**: The landing page MUST include a "final CTA" section near the end of the page that repeats the primary call to action without introducing new information, reinforcing urgency in a non-aggressive way.
- **FR-008**: Every primary or secondary CTA on the page MUST have the goal of letting the visitor "talk to a specialist," implemented via a button that opens WhatsApp with a prefilled message relevant to the context of the section where it appears.
- **FR-009**: All visible copy on the page MUST follow the approved brand tone (warm, clear, professional, reassuring), MUST use the "tú" form rather than "usted", and MUST avoid medical jargon the average patient wouldn't understand (e.g. clinical/diagnostic terminology, equipment or method names, or specialty labels) — describe in the everyday terms a patient would use instead, per the "no decir / sí decir" examples in branding.md.
- **FR-010**: The copy MUST explicitly avoid: the word "Contáctenos", pricing figures without context, and any mention of insurance or IMSS agreements (the lab does not currently have these arrangements).
- **FR-011**: All visual elements (colors, typography, logo) MUST follow the approved Brand Guidelines: the purple/lilac palette with Plus Jakarta Sans as the sole typeface, and the logo usage rules (minimum size, safe area, permitted backgrounds).
- **FR-012**: The landing page MUST be designed mobile-first, since most of the primary buyer persona's traffic browses from a phone, per the digital-behavior research.
- **FR-013**: The landing page MUST be a single static page (no authentication, no backend), reachable via a single public URL.
- **FR-014**: The landing page MUST meet the project constitution's performance requirements: a Lighthouse Performance score of 90 or higher, with essential content (hero value proposition and primary CTA) visible within 3 seconds on a simulated mid-range mobile connection.
- **FR-015**: The landing page MUST meet WCAG 2.1 AA requirements for color contrast, visible focus states on interactive elements, and descriptive alt text on all images.
- **FR-016**: The landing page MUST emit valid SEO metadata (title, meta description, canonical link, Open Graph/Twitter Card tags) and a `LocalBusiness` schema.org JSON-LD block, per the project constitution's SEO & Discoverability requirements.

### Key Entities

*(Not applicable — this page involves no persistent data entities; all content is static and editorial.)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new visitor can identify what the lab offers and what the expected action is (talk to a specialist) by viewing only the "hero" section, without scrolling.
- **SC-002**: The primary CTA is reachable without scrolling out of the section's viewport on both mobile and desktop.
- **SC-003**: The buyer persona's three most frequent doubts ("¿necesito cita?", "¿cuánto cuesta?", "¿son buenos con niños?") are answered in the visible content before the visitor reaches the "final CTA" section.
- **SC-004**: A visitor matching the secondary buyer persona (without young children) can find at least two trust signals relevant to them without feeling the page is aimed exclusively at families with children.
- **SC-005**: The page is fully usable and legible on a mid-range mobile device without needing to zoom or scroll horizontally.

## Assumptions

- "Talk to a specialist" is fulfilled through WhatsApp as the sole immediate contact channel; phone calls, a web form, and live chat are not included in this scope.
- The five requested sections (hero, problem, solution, social proof, final CTA) are the minimum scope of this specification. Additional content already approved in copy.md (detailed study list, process steps, extended FAQ, map and hours, footer) can be folded into the "solution" or "social proof" sections, or treated as a later iteration — it is not blocking for this specification.
- The page is published in Spanish (Mexico), with no requirement for multi-language support.
- The lab's real WhatsApp number has been confirmed by the client (+52 938 383 0700, Ciudad del Carmen / Campeche) and MUST be used in all CTA links; no placeholder number reaches production.
- Real reviews or testimonials from the lab (e.g., screenshots or links to Google Maps) are a client-sourcing task prior to launch, not a blocker for the rest of this specification; if they aren't obtained in time, the social-proof section is published with only quantitative signals.
- Results-download functionality and any authentication system are out of this scope, per briefing.md's indication that this is a separate "future phase."
- The location map, detailed hours, and extended FAQ, although already approved in copy.md, are not mandatory to satisfy this 5-section specification; including them is recommended if the implementation plan allows, but they are not an acceptance criterion here.
