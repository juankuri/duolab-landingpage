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

const SITE_ORIGIN = "https://laboratoriosduolab.com";

/** Google review deep-link — confirmed by client. Desktop QR is a future addition. */
const REVIEW_URL = "https://g.page/r/CZEYzWlxjxgbEBM/review";

// Shape follows data-model.md (LandingContent); TS infers it from this literal.
const content = {
    business: {
        name: "DúoLab",
        // Full single-line address — used for the map query and schema.org (geo).
        addressLine: "PLAZA PERLA DEL GOLFO, Local 21. Frente a la Subestación CFE, Fracc. Maderas",
        // Display-only: rendered as separate lines in Location/Footer (venue, then
        // street reference). Keep addressLine as the machine-readable source of truth.
        addressLines: [
            "PLAZA PERLA DEL GOLFO, Local 21",
            "Frente a la Subestación CFE, Fracc. Maderas",
        ],
        city: "Ciudad del Carmen, Campeche",
        phoneNumber: WHATSAPP_NUMBER,
        hours: [
            { label: "Lunes a viernes", value: "7:00 a.m. – 6:00 p.m." },
            { label: "Sábados", value: "7:00 a.m. – 2:00 p.m." },
            { label: "Domingos", value: "Solo con cita previa" },
        ],
        yearsOfOperation: 11,
        studyCount: "+2000",
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
            {
                context: "faq",
                text: "Hola, tengo una pregunta sobre los estudios.",
            },
            {
                context: "services",
                text: "Hola, tengo una indicación médica y quisiera saber la preparación, disponibilidad y tiempo de entrega del estudio.",
            },
        ],
    },

    seo: {
        title: "Laboratorio sin cita en Ciudad del Carmen — Resultados hoy",
        description:
            "Laboratorio en Ciudad del Carmen con 11 años de experiencia. Sin cita para análisis de rutina, resultados confiables el mismo día.",
        canonicalUrl: `${SITE_ORIGIN}/`,
        ogImage: null,
    },

    // SECCIÓN 1 — Hero (copy.md). H1 is verbatim and MUST NOT be paraphrased (FR-002).
    hero: {
        eyebrow: "Experiencia en el diagnóstico clínico a su servicio.",
        headline: "Laboratorio de análisis clínicos en Ciudad del Carmen​con resultados en los que confías",
        subheadline:
            "En DúoLab realizamos estudios de rutina y especiales con más de una década de experiencia. No necesitas cita para la mayoría de estudios. Sin sorpresas de precio. Con el trato que mereces.",
        primaryCtaMessageContext: "hero",
        ctaLabel: "Escríbenos",
        secondaryCta: {
            href: "https://www.google.com/maps/search/?api=1&query=DúoLab+laboratorio+San+Manuel+Ciudad+del+Carmen+Campeche",
            label: "Ver cómo llegar",
        },
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
            "Más de 2000 estudios de rutina y especiales en un solo lugar.",
            "Servicio de patología subrogado",
        ],
        childCareDifferentiator: {
            headline:
                "¿Tu hijo le tiene miedo a las agujas? Aquí sabemos cómo tratarlo.",
            body: "Contamos con experiencia en la toma de muestras a niños. Nuestro personal está capacitado para atender a los más pequeños con paciencia, calma y la técnica adecuada para que el proceso sea lo más rápido y cómodo posible. Tú también puedes estar presente durante todo el procedimiento.",
            bullets: [
                "Personal con experiencia en la toma de muestras a niños",
                "Proceso rápido y sin complicaciones",
                "Puedes acompañar a tu hijo en todo momento",
                "También aplica para jóvenes y adultos con temor a la punción.",
            ],
            ctaMessageContext: "solution-children",
            ctaLabel:
                "Escríbenos, te explicamos cómo prepararlo",
        },
    },

    // About — "Conoce DúoLab". Trust-building narrative (11 años, +200 estudios,
    // adultos y niños). Client-authored copy. CTA is an in-page anchor to the
    // location section, not a WhatsApp action.
    about: {
        eyebrow: "Conoce DúoLab",
        headline: "Más de una década cuidando cada resultado",
        paragraphs: [
            "En DúoLab somos un laboratorio de análisis clínicos y patología ubicados en Ciudad del Carmen. Desde hace 11 años ayudamos a nuestros pacientes a realizarse sus estudios con confianza, información clara y un trato cercano.",
            "Sabemos que acudir a un laboratorio puede generar dudas. Por eso te explicamos cómo prepararte, cuánto cuesta tu estudio y cuándo recibirás tus resultados antes de comenzar.",
            "Realizamos más de 2000 tipos de estudios de rutina y especiales, con atención para adultos y niños. Nuestro compromiso es que encuentres un proceso sencillo, una atención respetuosa y resultados en los que puedas confiar.",
        ],
        cta: {
            href: "#ubicacion",
            label: "Conoce nuestra ubicación",
        },
    },

    // Services — "Nuestros servicios". Client-authored. Specialty terms kept
    // abstracted (Constitution Principle VII). The highlight + CTA route to the
    // "services" prefilled WhatsApp message.
    services: {
        eyebrow: "Nuestros servicios",
        headline: "Los estudios que necesitas, en un solo lugar",
        intro: "Realizamos análisis clínicos de rutina y estudios especiales para ayudarte a cuidar y dar seguimiento a tu salud. Para la mayoría no necesitas cita: puedes acudir directamente durante nuestro horario de atención.",
        items: [
            {
                title: "Estudios de rutina",
                body: "Análisis frecuentes para revisiones médicas, seguimiento de tratamientos y cuidado preventivo.",
            },
            {
                title: "Estudios especiales",
                body: "Contamos con una amplia variedad de pruebas. Escríbenos para consultar disponibilidad, preparación y tiempo de entrega.",
            },
            {
                title: "Toma de muestras para niños",
                body: "Atendemos a los más pequeños con paciencia, calma y personal con experiencia. Puedes acompañar a tu hijo durante todo el procedimiento.",
            },
            {
                title: "Toma de muestras para adultos mayores",
                body: "También atendemos a personas mayores con empatía y tacto. Somos un laboratorio para todos, estamos para ayudar.",
            },
            {
                title: "Resultados oportunos",
                body: "La mayoría de los resultados están disponibles el mismo día. Para estudios especiales, te informamos el tiempo de entrega desde el primer contacto.",
            },
            {
                title: "Diferentes métodos de pago",
                body: "Aceptamos pagos con tarjeta de crédito o débito sin cargo adicional. También aceptamos pagos por transferencia. Facturamos el mismo día.",
                icon: "contactless",
            },
        ],
        highlight: {
            title: "¿No sabes qué preparación necesita tu estudio?",
            body: "Envíanos tu lista de estudios o tu solicitud médica por WhatsApp y te explicamos qué llevar, si necesitas ayuno y cuándo puedes acudir.",
        },
        ctaMessageContext: "services",
        ctaLabel: "Consultar un estudio",
    },

    // SECCIÓN 5 — Cómo funciona (copy.md, spec FR-007 intent). Rendered as a
    // timeline, not numbered circles (constitution Design Anti-Slop Patterns).
    how: {
        eyebrow: "Sin complicaciones",
        headline: "Así de fácil es hacerte tus estudios",
        steps: [
            {
                title: "Llega cuando puedas",
                body: "No necesitas cita para la mayoría de estudios. Atendemos de lunes a viernes de 7:00 a.m. a 6:00 p.m. y sábados de 7:00 a.m. a 2:00 p.m. Únicamente los domingos se coordina mediante cita.",
            },
            {
                title: "Te atendemos de inmediato",
                body: "Registramos tu estudio, preparamos la toma de muestra y te explicamos todo antes de empezar. Trato cercano desde el primer momento.",
            },
            {
                title: "Recibe tus resultados",
                body: "La mayoría de estudios quedan el mismo día. Los estudios especiales tienen un tiempo de entrega que te informamos al momento.",
            },
        ],
        note: "Algunos estudios requieren cita previa: cultivos vaginales, cultivos uretrales, pruebas microbiológicas y papanicolaou. Escríbenos para coordinar.",
    },

    // SECCIÓN 6 — Preguntas frecuentes (copy.md, spec FR-007 intent). The last
    // answer abstracts copy.md's "toma de muestras pediátricas" to plain language
    // (Constitution Principle VII — no medical specialty terminology in output).
    faq: {
        eyebrow: "Resolvemos tus dudas",
        headline: "Preguntas frecuentes",
        items: [
            {
                question: "¿Requiero tener una orden o solicitud médica para hacerme análisis?",
                answer:
                    "No es necesario, nosotros te damos asesoría biomédica para sugerir los análisis o con solo presentar un listado de lo que requieres",
            },
            {
                question: "¿Necesito cita para hacerme estudios?",
                answer:
                    "Para la mayoría de estudios de rutina no necesitas cita. Puedes llegar directamente en nuestro horario de atención. Solo algunos estudios especiales (cultivos vaginales, cultivos uretrales, pruebas microbiológicas y papanicolaou) requieren programación previa. Escríbenos si tienes duda.",
            },
            {
                question: "¿Necesito ir en ayunas?",
                answer:
                    "Depende del estudio. Glucosa, colesterol, triglicéridos y química sanguínea sí requieren ayuno (generalmente 8 a 12 horas). Estudios como el examen general de orina o la prueba de embarazo no lo requieren. Si no estás seguro, escríbenos antes de venir.",
            },
            {
                question: "¿Cuándo me entregan los resultados?",
                answer:
                    "La gran mayoría de estudios de rutina quedan el mismo día. Los estudios especiales tienen tiempos de 3, 5, 15 o hasta 20 días según el tipo. Al registrarte te informamos exactamente cuándo estará listo el tuyo.",
            },
            {
                question: "¿Cuánto cuestan los estudios?",
                answer:
                    "Los precios varían según el estudio. Manejamos promociones frecuentes en biometría hemática, glucosa, colesterol y triglicéridos. Escríbenos por WhatsApp para conocer el precio de lo que necesitas, sin compromiso.",
            },
            {
                question: "¿Trabajan con aseguradoras o IMSS?",
                answer:
                    "Tenemos precios especiales para pacientes del IMSS, ISSSTE y SSA.",
            },
            {
                question: "¿Puedo llevar a mi hijo pequeño?",
                answer:
                    "Claro que sí. Contamos con experiencia en la toma de muestras a niños y atendemos a pacientes de todas las edades.",
            },
        ],
        ctaMessageContext: "faq",
        ctaLabel: "¿Tienes otra pregunta?",
    },

    // SECCIÓN 7 — Ubicación y horarios (copy.md). Reuses `business` for the
    // address/hours already defined above; only the section framing lives here.
    // Rendered as an asymmetric two-column layout with a real embedded map, not
    // an emoji card grid (constitution Design Anti-Slop Patterns).
    location: {
        eyebrow: "Encuéntranos",
        headline: "Estamos cerca de ti",
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
        // `accent` marks the single word/segment rendered in Azul (#318BFF) — a
        // functional data-point highlight, not a brand color (DESIGN.md Accent Azul;
        // mirrors the PoC trust bar). Omit `accent` to render the whole value in purple.
        trustSignals: [
            { value: "11 años", accent: "años", label: "De experiencia" },
            { value: "+2000", accent: "+", label: "Tipos de estudios" },
            { value: "Mismo día", accent: "día", label: "La mayoría de resultados" },
            { value: "Sin cita", accent: "cita", label: "Llega cuando puedas" },
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

    // Review Us — "Tu opinión nos ayuda". Client-authored. CTA is an external
    // Google review deep-link (not WhatsApp). Real testimonials still stay in
    // socialProof.testimonials (null) until sourced; this asks for new reviews.
    reviewUs: {
        eyebrow: "Tu opinión nos ayuda",
        headline: "¿Cómo fue tu experiencia en DúoLab?",
        body: "Tu reseña ayuda a otras personas de Ciudad del Carmen a encontrar un laboratorio confiable y también nos permite seguir mejorando nuestra atención.",
        microcopy: "Solo te tomará un minuto.",
        cta: {
            href: REVIEW_URL,
            label: "Déjanos una reseña en Google",
        },
    },

    // SECCIÓN 8 — Final CTA (copy.md, spec FR-007, US2). Repeats the primary action
    // with soft (non-aggressive) urgency and introduces no new claim. Reuses the
    // existing "final-cta" prefilled WhatsApp message. Verbatim from copy.md.
    finalCta: {
        headline: "¿Tienes estudios pendientes?",
        subheadline:
            "No los dejes para después. Llega hoy, sin cita, y sal con tus resultados el mismo día.",
        ctaMessageContext: "final-cta",
        ctaLabel: "Mándanos un mensaje",
        microcopy:
            "Te respondemos lo más pronto posible y te decimos exactamente cómo prepararte.",
    },
};

export default content;
