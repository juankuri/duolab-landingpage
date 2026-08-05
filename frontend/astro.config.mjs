// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://laboratoriosduolab.com',
  // Keep the internal admin tool and the noindexed patient lookup out of the
  // public sitemap — reachable by the footer link, not by search discovery.
  integrations: [
    sitemap({
      filter: (page) => !page.includes("/admin") && !page.includes("/resultados"),
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
