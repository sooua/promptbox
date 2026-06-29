import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// Unit tests run in Node (main-process logic: repository persistence + sync
// merge). Mirror the `@shared` alias used by electron.vite.config.ts so the
// same imports resolve under Vitest.
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    globals: false
  }
})
