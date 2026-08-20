/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'chrome81',
  },
  optimizeDeps: {
    rolldownOptions: {
      transform: {
        target: 'chrome81',
      },
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['../../test/setup.ts'],
  },
});
