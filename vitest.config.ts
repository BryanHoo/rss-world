import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      'server-only': fileURLToPath(
        new URL('./src/test/mocks/server-only.ts', import.meta.url),
      ),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
