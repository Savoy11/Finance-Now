import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Vitest ran without a config until now, which worked only because every test
// so far imported relatively. Anything importing `@/…` — the alias used
// throughout src — failed to resolve. Mirror the tsconfig path mapping so tests
// and the app agree.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Next supplies `server-only` at build time; it is not in node_modules, so
      // vitest can't resolve it and every lib/server module importing it was
      // untestable. See test/stubs/server-only.ts.
      'server-only': path.resolve(__dirname, './test/stubs/server-only.ts'),
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Scoped to the layers the repo's testing convention actually targets:
      // "anything producing a dollar figure or a percentage a user acts on
      // should be pure and tested" (CLAUDE.md). Measuring page components and
      // route handlers here would bury that signal under thousands of lines of
      // JSX nobody intends to unit-test, and a coverage number nobody believes
      // is worse than none.
      include: [
        'src/lib/data/**/*.ts',
        'src/lib/risk/**/*.ts',
        'src/lib/utils/**/*.ts',
        'src/lib/server/**/*.ts',
        'src/lib/technicals/**/*.ts',
      ],
      exclude: ['**/__tests__/**', '**/*.d.ts'],
      // Deliberately NO thresholds. A failing threshold gates the wrong thing:
      // it blocks a fix for having arrived without a test, while saying nothing
      // about whether the tested lines are the ones carrying a user-facing
      // number. Report it, read it, decide — see docs/audits/2026-07-30-audit.md.
    },
  },
})
