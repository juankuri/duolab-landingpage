// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://laboratoriosduolab.com',
  // Keep the internal admin tool out of the public sitemap.
  integrations: [sitemap({ filter: (page) => !page.includes("/admin") })],
});
