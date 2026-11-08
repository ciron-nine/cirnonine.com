// @ts-check
import { defineConfig } from 'astro/config';
import fontSubsets from './src/fonts/integration';

export default defineConfig({
  site: 'https://cirnonine.com',
  integrations: [fontSubsets()],
});
