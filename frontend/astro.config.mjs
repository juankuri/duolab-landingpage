// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// See src/config/features.js for why this exists and when to delete it. Read
// from process.env here because astro.config runs in Node before Vite's
// import.meta.env is available; features.js reads the same variable the
// other way for component code.
const LEGAL_ENABLED = process.env.LEGAL_ENABLED === "1";

/**
 * The legal pages live in src/pages/_legal/, which Astro does not route: a
 * leading underscore excludes a directory from file-based routing. So an
 * unflagged build emits neither page at all — no HTML in dist/, nothing for
 * the asset server to serve, and /aviso-de-privacidad falls through to the
 * Worker and gets the real 404.
 *
 * That is the point. While the bodies are [PENDIENTE] placeholders, "not
 * indexed" is not enough; they have to not exist. injectRoute is Astro's own
 * mechanism for a conditional route, so this needs no build-time file shuffling.
 *
 * Delete this integration, features.js, and the two _legal/*.astro files' flag
 * dependency in the same commit that lands the approved legal copy — move the
 * pages to src/pages/ directly at that point.
 */
const legalRoutes = {
  name: "duolab-legal-routes",
  hooks: {
    "astro:config:setup": ({ injectRoute }) => {
      if (!LEGAL_ENABLED) return;

      injectRoute({
        pattern: "/aviso-de-privacidad",
        entrypoint: "./src/pages/_legal/aviso-de-privacidad.astro",
      });
      injectRoute({
        pattern: "/terminos-de-uso",
        entrypoint: "./src/pages/_legal/terminos-de-uso.astro",
      });
    },
  },
};

// https://astro.build/config
export default defineConfig({
  site: 'https://laboratoriosduolab.com',
  // Keep the internal admin tool and the noindexed patient lookup out of the
  // public sitemap — reachable by the footer link, not by search discovery.
  // /404 is a status page, not a destination. The legal pages are excluded
  // while they hold placeholder copy; drop that clause with the approved text.
  integrations: [
    legalRoutes,
    sitemap({
      filter: (page) =>
        !page.includes("/admin") &&
        !page.includes("/resultados") &&
        !page.includes("/404") &&
        !page.includes("/aviso-de-privacidad") &&
        !page.includes("/terminos-de-uso"),
    }),
  ],
  // pdfjs-dist is only ever reached through a runtime `await import()` inside
  // a page <script> (manager.astro) — Vite's
  // cold-start dependency scan doesn't see it, so the first request for it
  // triggers a re-optimize mid-session and the browser's in-flight request
  // for the old `?v=` hash 404s ("Failed to fetch dynamically imported
  // module"). Pre-bundling it here gives it a stable hash from server start.
  // The worker is excluded from the optimizer so
  // `new URL(..., import.meta.url)` still resolves to a real, unbundled
  // asset the browser can load directly.
  vite: {
    optimizeDeps: {
      include: ["pdfjs-dist/build/pdf.mjs"],
      exclude: ["pdfjs-dist/build/pdf.worker.min.mjs"],
    },
  },
});
