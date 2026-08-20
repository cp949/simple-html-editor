import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    // scripts/test/**는 node:test 기반 메타테스트다. vitest가 수집하면 0개 테스트로
    // "통과" 처리되어 node:test assertion 실패를 삼킨다 (check:gate-tests로 별도 실행).
    exclude: [...configDefaults.exclude, '.superpowers/**', 'e2e/**', 'scripts/test/**'],
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
});
