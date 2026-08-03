import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Separate from vite.config.js on purpose: the app's config loads the Base44
 * plugin, which injects the dev-server notifiers and the `@/` alias. None of
 * that belongs in a Node test run, so the alias is restated here instead —
 * same mapping as jsconfig.json's paths.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
    // Event dates render through toLocaleDateString, so the machine's zone is an
    // input. Pinned to the students' zone: west of UTC is where a date-only
    // calendar value can land on the wrong day, and a green run on a UTC box
    // would hide exactly that.
    env: { TZ: 'America/New_York' },
  },
});
