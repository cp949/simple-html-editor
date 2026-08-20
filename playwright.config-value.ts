import type { PlaywrightTestConfig } from '@playwright/test';

const config = {
  testDir: './e2e',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'pnpm --filter @cp949/editor-simple-demo dev --host 127.0.0.1 --port 4173 --force',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
} satisfies PlaywrightTestConfig;

export default config;
