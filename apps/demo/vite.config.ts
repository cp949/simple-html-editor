/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'chrome85',
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['../../test/setup.ts'],
  },
});
