import { describe, expect, it } from 'vitest';

import config from '../playwright.config';

describe('Playwright demo server config', () => {
  it('Playwright가 소비하는 설정 객체는 기존 4173 서버를 재사용하지 않는다', () => {
    expect(config.webServer).toMatchObject({ reuseExistingServer: false });
  });
});
