/**
 * DúoLab landing content — single source of truth for approved copy + config.
 *
 * Shapes follow data-model.md (LandingContent). All visible Spanish text is
 * reproduced verbatim from stakeholders/isabel/copy.md (Constitution Principle VI;
 * spec Clarifications 2026-06-28: copy.md is verbatim across every section it covers).
 *
 * Content rules enforced here (spec FR-006, FR-010, Principle VII):
 *   - No bare pricing figures, no "Contáctenos", no insurance/IMSS mentions.
 *   - No medical specialty terminology, even where source docs use it.
 *   - socialProof.testimonials stays null until real, sourced reviews exist.
 */

/** Real WhatsApp number — confirmed by client (spec.md Assumptions, 2026-06-28).
 *  E.164 digits, country code 52 + 9383830700. Not a placeholder. */
const WHATSAPP_NUMBER = "529381156464";
const PHONE_NUMBER = "529383830700";

/** Canonical site origin. TODO: confirm the production domain with the client
 *  before deploy; update here (single source for canonical + OG + JSON-LD). */
const SITE_ORIGIN = "https://duolab.mx";

// Shape follows data-model.md (LandingContent); TS infers it from this literal.
const content = {
    business: {
        name: "DúoLab",
        addressLine: "Frente a la Subestación CFE, San Manuel",
        city: "Ciudad del Carmen, Campeche",
        phoneNumber: WHATSAPP_NUMBER,
        hours: [
            { label: "Lunes a viernes", value: "7:00 a.m. – 6:00 p.m." },
            { label: "Sábados", value: "7:00 a.m. – 2:00 p.m." },
            { label: "Domingos", value: "Solo con cita previa" },
        ],
        yearsOfOperation: 11,
        studyCount: "+200",
    },

    whatsapp: {
        phoneNumber: WHATSAPP_NUMBER,
        /** @type {{ context: string, text: string }[]} */
        messages: [
            {
                context: "hero",
                text: "Hola, quisiera información sobre los estudios disponibles.",
            },
            {
                context: "solution-children",
                text: "Hola, quiero llevar a mi hijo a hacerse estudios. ¿Cómo lo preparo y necesito cita?",
            },
            {
                context: "final-cta",
                text: "Hola, tengo estudios pendientes y quisiera información para hacérmelos.",
            },
        ],
    },

    seo: {
        title: "DúoLab — Laboratorio de análisis clínicos en Ciudad del Carmen, sin cita",
        description:
            "Estudios de rutina y especiales con más de una década de experiencia en Ciudad del Carmen. Sin cita para la mayoría de estudios, resultados confiables el mismo día y trato cercano. Escríbenos por WhatsApp.",
        canonicalUrl: `${SITE_ORIGIN}/`,
        ogImage: null,
    },

    // SECCIÓN 1 — Hero (copy.md). H1 is verbatim and MUST NOT be paraphrased (FR-002).
    hero: {
        eyebrow: "Tus análisis clínicos, con resultados en los que confías.",
        headline: "11 años cuidando la salud en\u200B Ciudad del Carmen",
        subheadline:
            "En DúoLab realizamos estudios de rutina y especiales con la experiencia de más de una década. Sin cita para la mayoría de estudios. Sin sorpresas de precio. Con el trato que mereces.",
        primaryCtaMessageContext: "hero",
        ctaLabel: "Escríbenos por WhatsApp",
        secondaryCta: {
            href: "https://www.google.com/maps/search/?api=1&query=DúoLab+laboratorio+San+Manuel+Ciudad+del+Carmen+Campeche",
            label: "Ver cómo llegar",
        },
    },

    // Problem section (spec FR-003). copy.md has no dedicated "problema" block, so the
    // framing is authored in brand voice; the concerns are the buyer persona's own
    // first-person questions, verbatim from offer.md "Problema Real que Enfrenta".
    problem: {
        eyebrow: "Sabemos lo que te preocupa",
        headline: "Antes de ir al laboratorio, todos tenemos las mismas dudas",
        concerns: [
            "¿Necesito cita o puedo llegar directo?",
            "¿Cuánto voy a pagar? ¿Me va a alcanzar?",
            "¿Mi hijo va a llorar mucho? ¿Sabrán tratarlo?",
            "¿Puedo confiar en estos resultados o me los van a cuestionar en el consultorio?",
            "¿Llego y resulta que me falta algo?",
        ],
    },

    // Solution section (spec FR-004, FR-005). offerPoints answer each problem concern;
    // childCareDifferentiator is copy.md SECCIÓN 4 with every specialty term abstracted
    // to plain language (Constitution Principle VII).
    solution: {
        eyebrow: "Para que llegues sin dudas",
        headline: "Resolvemos cada duda antes de que llegues",
        offerPoints: [
            "Sin cita para la mayoría de estudios: llega directo en nuestro horario de atención.",
            "Precios claros desde el primer contacto, sin sorpresas cuando llegas.",
            "Te decimos por WhatsApp qué llevar, si necesitas ayuno y cómo prepararte.",
            "Resultados confiables: la mayoría quedan el mismo día.",
            "Más de 50 estudios de rutina y especiales en un solo lugar.",
        ],
        childCareDifferentiator: {
            headline:
                "¿Tu hijo le tiene miedo a las agujas? Aquí sabemos cómo tratarlo.",
            body: "Contamos con experiencia en la toma de muestras a niños. Nuestro personal está capacitado para atender a los más pequeños con paciencia, calma y la técnica adecuada para que el proceso sea lo más rápido y cómodo posible. Tú también puedes estar presente durante todo el procedimiento.",
            bullets: [
                "Personal con experiencia en la toma de muestras a niños",
                "Proceso rápido y sin complicaciones",
                "Puedes acompañar a tu hijo en todo momento",
            ],
            ctaMessageContext: "solution-children",
            ctaLabel:
                "Escríbenos antes de venir, te explicamos cómo prepararlo",
        },
    },

    // SECCIÓN 2 — Trust bar / social proof (spec FR-006, US2). Quantitative-only
    // signals in copy.md's verbatim labels (spec Clarification 2026-06-28: trust-bar
    // labels are verbatim). These carry credibility on their own for the secondary
    // persona (Roberto), who self-qualifies on concrete facts — no appointment,
    // same-day results, breadth of studies, a decade of experience — without needing
    // the children-care section. `testimonials` is intentionally absent until the
    // client sources real, verifiable reviews; SocialProof renders no quote block in
    // its absence (FR-006 — never placeholder quotes). Real testimonials are wired in
    // by US3 (T023/T024).
    socialProof: {
        trustSignals: [
            { value: "11 años", label: "De experiencia" },
            { value: "+200", label: "Tipos de estudios" },
            { value: "Mismo día", label: "La mayoría de resultados" },
            { value: "Sin cita", label: "Llega cuando puedas" },
        ],
        // US3 (spec FR-006, data-model.md Testimonial). MUST stay `null` until the
        // client provides real, verifiable reviews (e.g. sourced Google Maps quotes).
        // SocialProof renders NO testimonial block while this is null/empty — never a
        // placeholder or generic quote (constitution "Proof over claim"). To populate
        // later, replace `null` with an array of:
        //   { quote: string,          // verbatim from the real review
        //     author: string,         // first name / initial, as the client approves
        //     source: string,         // e.g. "Google Maps"
        //     sourceUrl: string|null } // link to the original review, if available
        /** @type {{ quote: string, author: string, source: string, sourceUrl: string | null }[] | null} */
        testimonials: null,
        // testimonials: [
        //     {
        //         quote: "[PLACEHOLDER: Verbatim quote from Google Maps review — e.g., 'Tengo años llendo con ellos. Y excelente servicio, muy amables y cuidadoso']",
        //         author: "[NOMBRE]",
        //         source: "Google Maps",
        //         sourceUrl: "https://maps.google.com/?cid=DUOLAB_CID#reviews",
        //     },
        //     {
        //         quote: "[PLACEHOLDER: Quote highlighting experience with children — e.g., 'Recomendable para los que les tienen miedo a que les saquen muestras']",
        //         author: "[NOMBRE]",
        //         source: "Google Maps",
        //         sourceUrl: "https://maps.google.com/?cid=DUOLAB_CID#reviews",
        //     },
        //     {
        //         quote: "[PLACEHOLDER: Quote about speed/comfort of the process — e.g., 'Con él no siento la aguja']",
        //         author: "[NOMBRE]",
        //         source: "Google Maps",
        //         sourceUrl: "https://maps.google.com/?cid=DUOLAB_CID#reviews",
        //     },
        // ],
    },

    // SECCIÓN 8 — Final CTA (copy.md, spec FR-007, US2). Repeats the primary action
    // with soft (non-aggressive) urgency and introduces no new claim. Reuses the
    // existing "final-cta" prefilled WhatsApp message. Verbatim from copy.md.
    finalCta: {
        headline: "¿Tienes estudios pendientes?",
        subheadline:
            "No los dejes para después. Llega hoy, sin cita, y sal con tus resultados el mismo día.",
        ctaMessageContext: "final-cta",
        ctaLabel: "Escríbenos por WhatsApp",
        microcopy:
            "Te respondemos lo más pronto posible y te decimos exactamente cómo prepararte.",
    },
};

export default content;
