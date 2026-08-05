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
  // Without this a component test dies on "React is not defined": the app's
  // config gets the automatic runtime from the React plugin, and this config
  // deliberately does not load that plugin.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    // Backend functions under base44/ are Deno TypeScript and cannot be
    // imported by Node as they stand, so their tests load them through a small
    // harness of their own. Including them here is what lets those run at all.
    // They are a net, not the suite — the authority on campusEvents is 50 Deno
    // tests outside the repo; see base44/functions/campusEvents/entry.test.js
    // for the command, and run BOTH before touching that function.
    // `.test.jsx` is here because leaving it out silently skips every test that
    // renders a component. The campus page's own suite sat unrun for exactly
    // that reason: it was written, it passed locally under an explicit path,
    // and `npm test` never picked it up.
    include: ['src/**/*.test.js', 'src/**/*.test.jsx', 'base44/**/*.test.js'],
    // Event dates render through toLocaleDateString, so the machine's zone is an
    // input. Pinned to the students' zone: west of UTC is where a date-only
    // calendar value can land on the wrong day, and a green run on a UTC box
    // would hide exactly that.
    env: { TZ: 'America/New_York' },
  },
});
