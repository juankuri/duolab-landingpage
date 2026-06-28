# Proceso de Diseño Web — Laboratorio de Análisis Clínicos

Stack: Astro + JS puro + GitHub + Cloudflare Pages
Fase actual: Landing page con CTA a WhatsApp

---

## Fase 0 — Briefing y Discovery (con tu familiar)

Esta es la fase que te ahorra el 80% de los retrabajos. No toques código ni Figma hasta completarla.

### Reunión de briefing

Siéntate con tu familiar y resuelvan juntos estas preguntas. Graba la conversación o toma notas textuales, porque las vas a necesitar para todo lo demás.

**Sobre el negocio:**
- ¿Qué análisis hacen? ¿Hay alguno que sea su especialidad o su servicio estrella?
- ¿Qué los diferencia de otros laboratorios? (ubicación, rapidez, precio, equipo, trato, horario)
- ¿Cuál es el horario de atención?
- ¿Aceptan citas o es por orden de llegada?
- ¿Trabajan con aseguradoras o convenios empresariales?

**Sobre los pacientes (buyer persona):**
- ¿Quién llega más? (adultos mayores, mamás con niños, empresas que mandan empleados, jóvenes)
- ¿Cómo los encuentran hoy? (recomendación, Google Maps, redes, pasan caminando)
- ¿Qué preguntas hacen siempre por teléfono o en mostrador? (precios, si necesitan cita, si necesitan ayuno, dónde están)

**Sobre la landing:**
- ¿Qué quieren que pase cuando alguien entre a la página? (que manden WhatsApp, que lleguen al lab, que descarguen resultados)
- ¿Hay algo que NO quieran en la página?
- ¿Tienen fotos del laboratorio, del equipo, de las instalaciones?

### Entregable de esta fase

Un documento corto (1-2 páginas) que resuma todo lo anterior. Este es tu "contrato informal" — lo que está aquí es lo que se construye, lo que no está aquí no se construye. Ambos lo revisan y lo aprueban.

---

## Fase 1 — Brand Guidelines Digital

Antes de diseñar la landing, formaliza la identidad visual en un PDF de referencia. Esto evita que cada decisión de diseño sea una discusión.

### Qué incluir

- **Logo:** versiones permitidas (color, monocromático, sobre fondo oscuro), tamaño mínimo, espacio de respeto
- **Paleta de colores:** primario, secundario, neutros, y sus códigos hex/RGB. Incluir colores para estados (éxito, error, información) que usarás en la web
- **Tipografía:** selección de 2 fuentes de Google Fonts (una para títulos, una para cuerpo). Definir pesos, tamaños base, y jerarquía (h1, h2, h3, body, caption)
- **Tono de comunicación:** ¿cómo habla el laboratorio? (profesional pero cercano, formal, etc.)
- **Fotografía:** lineamientos básicos — si usan fotos propias, qué estilo deben tener

### Criterios para elegir tipografía

Para un laboratorio clínico busca el balance entre confianza profesional y accesibilidad humana. Evita tipografías demasiado frías/corporativas (se sienten como hospital grande) y demasiado informales (no transmiten seriedad médica).

Algunas combinaciones que funcionan bien para salud:
- **Títulos:** Inter, DM Sans, Plus Jakarta Sans, Outfit
- **Cuerpo:** Inter, Source Sans 3, Nunito Sans

Prueba las combinaciones en Google Fonts antes de decidir. Muéstrale 2-3 opciones a tu familiar con texto real del laboratorio, no con Lorem Ipsum.

### Entregable de esta fase

PDF de Brand Guidelines (1-4 páginas). Ambos lo aprueban. A partir de aquí, cualquier decisión visual se resuelve consultando este documento.

---

## Fase 2 — Contenido y Copy (ANTES del diseño)

El error más común es diseñar primero y escribir después. Eso genera layouts que no encajan con el contenido real. Escribe todo el texto antes de abrir cualquier herramienta de diseño.

### Estructura de la landing (secciones)

1. **Hero:** propuesta de valor clara + CTA principal
2. **Servicios:** qué análisis ofrecen (los más solicitados)
3. **¿Por qué elegirnos?:** diferenciadores del laboratorio
4. **Cómo funciona:** pasos simples del proceso (llegar, toma de muestra, resultados)
5. **Ubicación y horario:** mapa embebido + datos de contacto
6. **CTA final:** botón de WhatsApp repetido

### Cómo escribir el copy

- Escribe desde el paciente, no desde el laboratorio. "Recibe tus resultados en 24 horas" es mejor que "Entregamos resultados en 24 horas."
- Responde las preguntas frecuentes que identificaste en el briefing directamente en el contenido.
- El CTA principal debe ser específico: "Agenda tu cita por WhatsApp" es mejor que "Contáctanos."
- No uses jerga médica innecesaria. Si el paciente promedio no entiende la palabra, cámbiala.

### Entregable de esta fase

Un documento con todo el texto final, sección por sección, aprobado por tu familiar. Incluir qué imágenes van en cada sección (aunque sean descripciones como "foto de la fachada del laboratorio").

---

## Fase 3 — Wireframe de baja fidelidad

Con el contenido aprobado, ahora sí defines la estructura visual. Pero todavía sin colores, sin tipografía final, sin detalles.

### Qué hacer

- Dibuja en papel o en una herramienta simple (Excalidraw, Figma con rectángulos grises) cómo se organiza cada sección.
- Define: qué va arriba, qué va abajo, dónde van las imágenes, dónde los textos, dónde los CTAs.
- Haz versión desktop y versión mobile (mobile first si la mayoría de pacientes llegan por celular, que probablemente sí).
- No te preocupes por que se vea bonito. Preocúpate por que el flujo de información tenga sentido.

### Checkpoint con tu familiar

Muéstrale el wireframe. La pregunta clave es: "¿La información está completa y en el orden correcto?" No le preguntes si le gusta el diseño porque todavía no hay diseño.

### Entregable de esta fase

Wireframe aprobado. A partir de aquí, la estructura no cambia (o cambia con costo).

---

## Fase 4 — Diseño visual (mockup)

Ahora aplicas las Brand Guidelines al wireframe aprobado con el contenido aprobado. Todo lo que necesitas ya está decidido.

### Proceso

- Aplica la paleta de colores, tipografía y espaciado del brand guide.
- Inserta las imágenes reales (o placeholders realistas si aún no las tienen).
- Diseña los componentes: botones, tarjetas de servicios, sección de mapa, footer.
- Revisa contraste y accesibilidad (texto sobre fondos, tamaños de fuente).
- Asegúrate de que el diseño funcione en mobile.

### Herramientas

Puedes hacer el mockup en Figma (recomendado para mostrar al cliente) o directamente en código si te sientes cómodo. Si lo haces en código, despliega una versión de preview en Cloudflare Pages para que tu familiar la vea en su celular.

### Checkpoint con tu familiar

Aquí sí pregunta: "¿Te gusta cómo se ve? ¿Representa al laboratorio?" Dale 2-3 días para que lo piense y te dé feedback consolidado, no feedback diario que cambia.

### Entregable de esta fase

Mockup visual aprobado. Después de este punto, solo se permiten ajustes menores (cambiar un color, mover un elemento), no reestructuraciones.

---

## Fase 5 — Desarrollo en Astro

Con todo aprobado, el desarrollo debería ser la parte más rápida porque no estás tomando decisiones, solo ejecutando.

### Setup del proyecto

```
src/
├── components/
│   ├── Hero.astro
│   ├── Services.astro
│   ├── WhyUs.astro
│   ├── HowItWorks.astro
│   ├── LocationMap.astro
│   ├── Footer.astro
│   └── WhatsAppButton.astro
├── layouts/
│   └── Layout.astro
├── pages/
│   └── index.astro
└── styles/
    └── global.css
```

### Checklist técnico

- [ ] Responsive (probar en móvil real, no solo DevTools)
- [ ] SEO básico: title, meta description, Open Graph tags
- [ ] Favicon con el logo del laboratorio
- [ ] Google Maps embebido (o enlace a Maps)
- [ ] Botón de WhatsApp con mensaje pre-llenado: `https://wa.me/52XXXXXXXXXX?text=Hola,%20quisiera%20información%20sobre...`
- [ ] Imágenes optimizadas (usar el componente `<Image>` de Astro)
- [ ] Performance: apuntar a 90+ en Lighthouse
- [ ] Datos estructurados (schema.org LocalBusiness) para SEO local
- [ ] Google Search Console configurado

### Deploy

- Push a GitHub → Cloudflare Pages hace el build automático.
- Configurar dominio personalizado si ya tienen uno.
- Verificar que el SSL esté activo.

---

## Fase 6 — QA y lanzamiento

### Testing antes de publicar

- Abre la página en: Chrome, Safari, Firefox (al menos)
- Prueba en tu celular y en el celular de tu familiar
- Haz clic en todos los links y botones
- Verifica que el WhatsApp abre con el número correcto
- Revisa que no haya typos en el contenido
- Corre Lighthouse y corrige lo que esté en rojo
- Prueba el mapa: ¿lleva a la ubicación correcta?

### Lanzamiento

- Comparte la URL con tu familiar para revisión final
- Si aprueba, conecta el dominio definitivo
- Publica la URL en Google Business Profile del laboratorio
- Comparte en las redes sociales del negocio si las tienen

---

## Resumen del flujo de aprobaciones

| Fase | Qué se aprueba | Qué se bloquea después |
|------|----------------|----------------------|
| 0. Briefing | Alcance y objetivos | No se agregan features nuevas |
| 1. Brand | Colores, tipografía, tono | No se cambian colores ni fuentes |
| 2. Copy | Textos finales | No se reescribe contenido |
| 3. Wireframe | Estructura y orden | No se reorganizan secciones |
| 4. Mockup | Diseño visual | No se rediseña |
| 5. Dev | Implementación | Solo bugs y ajustes menores |

La clave es esta: cada fase bloquea decisiones para que no regreses. Si tu familiar quiere cambiar algo de una fase anterior, está bien, pero ambos deben ser conscientes de que eso tiene costo en tiempo y esfuerzo. Así se trabaja profesionalmente.

---

## Fase futura — Descarga de resultados

Cuando la landing esté publicada y funcionando, entonces evalúa si la descarga de resultados vale la pena. Eso implica un proyecto separado con su propio proceso: definir el formato del PDF de resultados, implementar un sistema de autenticación básico (aunque sea por folio + fecha de nacimiento), y un panel donde el laboratorio suba los archivos. No lo mezcles con la landing.
