import { configDefaults, defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const sharedExcludes = [
  ...configDefaults.exclude,
  '**/.next/**',
  '**/.worktrees/**',
  '**/.pnpm-store/**',
  '**/artifacts/**',
];

const nodeTestGlobs = [
  'src/server/**/*.test.ts',
  'src/worker/**/*.test.ts',
  'src/app/api/**/*.test.ts',
  'src/lib/**/*.test.ts',
  'src/utils/**/*.test.ts',
  'src/data/**/*.test.ts',
];

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
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: nodeTestGlobs,
          exclude: sharedExcludes,
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['src/**/*.{test,spec}.{ts,tsx}'],
          exclude: [...sharedExcludes, ...nodeTestGlobs],
        },
      },
    ],
  },
});
