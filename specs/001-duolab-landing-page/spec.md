# Feature Specification: Landing Page de Conversión — DúoLab

**Feature Branch**: `001-duolab-landing-page`

**Created**: 2026-06-27

**Status**: Draft

**Input**: User description: "Lee todos los documentos en /clientes/isabel/ (briefing.md, buyer-persona.md, branding.md, offer.md, copy.md). Con esa información, genera la especificación para una landing page de conversión. La landing debe: comunicar la propuesta de valor definida en la oferta; hablar directamente al buyer persona descrito; usar el tono y copy aprobados; seguir los lineamientos de branding; tener como objetivo principal 'Hablar con un especialista'; incluir las secciones hero, problema, solución, prueba social, CTA final."

## Clarifications

### Session 2026-06-27

- Q: Should the hero H1 be the exact approved text from copy.md verbatim, or can it be adapted during implementation? → A: Use the H1 from copy.md verbatim, word-for-word, no paraphrasing allowed.
- Q: What should happen in the "prueba social" section given no real DúoLab testimonial/review is sourced yet in the client docs? → A: Require real Google reviews/testimonials sourced from the client before launch; until sourced, ship with only quantitative trust signals (years, # of studies) — no placeholder quotes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Madre con hijos pequeños busca un laboratorio de confianza (Priority: P1)

Carla llega a la página después de buscar "laboratorio de análisis Ciudad del Carmen" en Google o de que alguien lo recomendara en un grupo de WhatsApp. Trae dudas concretas: si necesita cita, cuánto va a costar, y sobre todo si el personal sabe tratar a su hijo, que le tiene miedo a las agujas. Lee la página de arriba a abajo buscando esa tranquilidad antes de decidir ir, y termina escribiendo por WhatsApp para confirmar que puede llevar a su hijo.

**Why this priority**: Es el buyer persona principal identificado en la investigación (buyer-persona.md) y el diferenciador de experiencia atendiendo niños es, según offer.md, la ventaja competitiva más fuerte del negocio. Si la página no convierte a esta persona, no cumple su propósito principal.

**Independent Test**: Se puede probar mostrando la página a una madre con hijos pequeños y verificando que, sin ayuda externa, identifica que el laboratorio atiende niños con experiencia, que no necesita cita, y que sabe cómo contactar a un especialista por WhatsApp.

**Acceptance Scenarios**:

1. **Given** Carla abre la landing en su celular, **When** revisa la sección de solución, **Then** encuentra una mención explícita y visible de la experiencia en toma de muestras a niños antes de llegar al CTA final.
2. **Given** Carla tiene dudas sobre cita y precio, **When** lee la sección de problema, **Then** reconoce su propia duda reflejada en el texto (en su mismo lenguaje, no en jerga médica).
3. **Given** Carla decide contactar al laboratorio, **When** toca el botón de CTA principal, **Then** se abre WhatsApp con un mensaje pre-llenado relacionado a su consulta.

---

### User Story 2 - Adulto que posterga su salud necesita resolver rápido (Priority: P2)

Roberto llega porque el médico le pidió estudios y quiere "quitárselos de encima" sin perder tiempo. No quiere preguntar de más: busca saber rápido si puede llegar sin cita, qué tan confiable es el laboratorio, y cómo contactar para confirmar antes de ir.

**Why this priority**: Es el buyer persona secundario (buyer-persona.md). Su conversión es valiosa pero secundaria frente al diferenciador de experiencia atendiendo niños que es el ángulo principal de marketing.

**Independent Test**: Se puede probar mostrando la página a un adulto sin hijos pequeños y verificando que igual encuentra, sin sentirse excluido por el mensaje enfocado en niños, la información de confianza (años de experiencia, sin cita, resultados confiables) y el CTA para hablar con un especialista.

**Acceptance Scenarios**:

1. **Given** Roberto entra a la página, **When** revisa la sección de prueba social, **Then** encuentra señales de confianza (años de experiencia, número de estudios, resultados el mismo día) sin necesidad de leer la sección dedicada a niños.
2. **Given** Roberto quiere confirmar antes de ir, **When** llega al CTA final, **Then** encuentra un mensaje claro y sin tecnicismos que lo invita a hablar con un especialista por WhatsApp.

---

### User Story 3 - Visitante que compara antes de decidir busca validación social (Priority: P3)

Un visitante que encontró el laboratorio en Google Maps o por recomendación quiere confirmar, antes de escribir, que otras personas han tenido buenas experiencias y que el negocio es legítimo y establecido.

**Why this priority**: Refuerza la decisión de conversión pero no es, por sí sola, suficiente para producir la acción principal — funciona en conjunto con las secciones de problema/solución.

**Independent Test**: Se puede probar verificando que un visitante, viendo solo la sección de prueba social de forma aislada, puede nombrar al menos dos señales de confianza del laboratorio (años de experiencia, cantidad de estudios, evidencia de buen trato).

**Acceptance Scenarios**:

1. **Given** el visitante llega a la sección de prueba social, **When** la lee, **Then** identifica al menos dos datos de confianza concretos (por ejemplo: "11 años de experiencia", "+50 estudios disponibles").

---

### Edge Cases

- ¿Qué pasa si el visitante abre la página en un dispositivo sin WhatsApp instalado? El CTA debe seguir funcionando vía WhatsApp Web.
- ¿Qué pasa si el visitante es del buyer persona secundario y la página enfatiza demasiado el mensaje de atención para niños? La sección de atención para niños debe estar claramente delimitada como una sección propia, sin dominar el resto del contenido ni hacer sentir excluido a quien no tiene hijos.
- ¿Qué pasa si el visitante llega con una conexión móvil lenta? El contenido esencial (propuesta de valor y CTA) debe ser visible y utilizable antes de que cargue cualquier elemento secundario.
- ¿Qué pasa si todavía no se tiene el número real de WhatsApp del laboratorio al momento de publicar? La página no debe publicarse con un número de marcador de posición.
- ¿Qué pasa si todavía no se tienen reseñas o testimonios reales del laboratorio al momento de publicar? La sección de prueba social se publica solo con señales de confianza cuantitativas (años de operación, cantidad de estudios, tiempo de entrega); no se rellena con testimonios genéricos o no verificados.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La landing MUST incluir una sección "hero" visible sin necesidad de scroll que comunique en una frase la propuesta de valor central de la oferta (resultados confiables + trato humano) y MUST incluir el CTA principal en el mismo viewport.
- **FR-002**: La sección "hero" MUST usar como H1 el texto exacto y aprobado en copy.md ("Tus análisis clínicos, con resultados en los que confías.") palabra por palabra, sin paráfrasis, junto con un subtítulo de apoyo, sin mezclar múltiples propuestas de valor que compitan entre sí.
- **FR-003**: La landing MUST incluir una sección "problema" que nombre, en el lenguaje real del buyer persona (no en jerga médica ni institucional), las dudas y miedos identificados en la investigación: necesidad de cita, incertidumbre de precio, miedo al trato hacia los hijos, y desconfianza en los resultados.
- **FR-004**: La landing MUST incluir una sección "solución" que presente la oferta del laboratorio (más de 50 estudios, atención sin cita, orientación previa por WhatsApp, precios claros desde el primer contacto) como respuesta directa a cada duda planteada en la sección "problema".
- **FR-005**: La sección "solución" MUST dar prominencia visual y de contenido diferenciada al diferenciador en atención para niños (experiencia en toma de muestras para niños), por ser el factor de decisión más fuerte identificado para el buyer persona principal.
- **FR-006**: La landing MUST incluir una sección "prueba social" que muestre señales de confianza verificables: años de operación, cantidad de tipos de estudios disponibles, y tiempo de entrega de resultados. Si al momento de publicar el cliente ya proporcionó reseñas o testimonios reales y verificables (p. ej. capturas o enlaces a reseñas de Google), la sección MUST incluirlos. Si todavía no se han obtenido, la sección MUST publicarse solo con las señales de confianza cuantitativas — MUST NOT incluir testimonios o citas de pacientes genéricas o no verificadas como relleno.
- **FR-007**: La landing MUST incluir una sección "CTA final" cerca del final de la página que repita el llamado a la acción principal sin introducir información nueva, reforzando la urgencia de manera no agresiva.
- **FR-008**: Todo CTA principal o secundario en la página MUST tener como objetivo permitir al visitante "hablar con un especialista", realizado a través de un botón que abre WhatsApp con un mensaje pre-llenado relevante al contexto de la sección donde aparece.
- **FR-009**: Todo el copy visible en la página MUST seguir el tono de marca aprobado (cercano, claro, profesional, tranquilizador), MUST usar la forma "tú" en lugar de "usted", y MUST evitar tecnicismos médicos que el paciente promedio no entendería.
- **FR-010**: El copy MUST evitar explícitamente: la palabra "Contáctenos", cifras de precio sin contexto, y cualquier mención de convenios con aseguradoras o IMSS (el laboratorio no maneja estos convenios actualmente).
- **FR-011**: Todos los elementos visuales (colores, tipografía, logo) MUST seguir los Brand Guidelines aprobados: paleta de morados/lilas con Plus Jakarta Sans como tipografía única, y reglas de uso del logo (tamaño mínimo, espacio de respeto, fondos permitidos).
- **FR-012**: La landing MUST estar diseñada mobile-first, dado que la mayoría del tráfico del buyer persona principal navega desde celular según la investigación de comportamiento digital.
- **FR-013**: La landing MUST ser una página estática de una sola vista (sin autenticación ni backend), accesible mediante una única URL pública.

### Key Entities

*(No aplica — esta página no involucra entidades de datos persistentes; todo el contenido es estático y editorial.)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un visitante nuevo puede identificar qué ofrece el laboratorio y cuál es la acción esperada (hablar con un especialista) viendo únicamente la sección "hero", sin hacer scroll.
- **SC-002**: Al menos el 95% de los visitantes que deciden actuar pueden localizar y activar el botón de contacto principal sin tener que buscarlo fuera de la vista inmediata de cada sección.
- **SC-003**: Las tres dudas más frecuentes del buyer persona ("¿necesito cita?", "¿cuánto cuesta?", "¿son buenos con niños?") quedan respondidas en el contenido visible antes de que el visitante llegue a la sección "CTA final".
- **SC-004**: Un visitante del buyer persona secundario (sin hijos pequeños) puede encontrar al menos dos señales de confianza relevantes para él sin sentir que la página está dirigida exclusivamente a familias con niños.
- **SC-005**: La página es completamente utilizable y legible en un dispositivo móvil de gama media sin necesidad de zoom o scroll horizontal.

## Assumptions

- "Hablar con un especialista" se cumple a través de WhatsApp como único canal de contacto inmediato; no se incluyen en este alcance llamada telefónica, formulario web, ni chat en vivo.
- Las cinco secciones solicitadas (hero, problema, solución, prueba social, CTA final) son el alcance mínimo de esta especificación. Contenido adicional ya aprobado en copy.md (detalle de estudios disponibles, pasos del proceso, FAQ extendido, mapa y horarios, footer) puede integrarse dentro de las secciones "solución" o "prueba social", o tratarse como una iteración posterior — no es bloqueante para esta especificación.
- La página se publica en español (México), sin requerimiento de soporte multi-idioma.
- El número de WhatsApp real del laboratorio se confirma con el cliente antes de publicación; hasta entonces se usa un marcador de posición que MUST NOT llegar a producción.
- Reseñas o testimonios reales del laboratorio (p. ej. capturas o enlaces a Google Maps) son una tarea de sourcing con el cliente previa al lanzamiento, no un bloqueante para el resto de la especificación; si no se obtienen a tiempo, la sección de prueba social se publica solo con señales cuantitativas.
- No se incluye en este alcance la funcionalidad de descarga de resultados ni ningún sistema de autenticación, conforme a lo indicado en briefing.md como "fase futura" separada.
- El mapa de ubicación, horarios detallados y FAQ extendido, aunque están aprobados en copy.md, no son obligatorios para cumplir esta especificación de 5 secciones; se recomienda incluirlos si el plan de implementación lo permite, pero no son criterio de aceptación aquí.
