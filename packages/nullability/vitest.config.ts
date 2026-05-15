import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    maxConcurrency: 8,
    testTimeout: 20_000,
  },
});
