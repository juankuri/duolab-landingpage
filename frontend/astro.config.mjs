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
});
