import { describe, expect, it } from 'vitest';

import { isAllowedImageSrc, isAllowedLinkHref } from '../src/html-policy';

describe('HTML URL 정책', () => {
  it('허용된 링크 protocol과 상대·hash 링크를 유지한다', () => {
    expect(isAllowedLinkHref('https://consumer.example/help')).toBe(true);
    expect(isAllowedLinkHref('mailto:help@example.com')).toBe(true);
    expect(isAllowedLinkHref('/bbs/1')).toBe(true);
    expect(isAllowedLinkHref('#answer')).toBe(true);
    expect(isAllowedLinkHref('TEL:02-1234-5678')).toBe(true);
  });

  it('실행 가능하거나 protocol-relative인 링크를 거부한다', () => {
    expect(isAllowedLinkHref('javascript:alert(1)')).toBe(false);
    expect(isAllowedLinkHref('java\nscript:alert(1)')).toBe(false);
    expect(isAllowedLinkHref('DATA:text/html;base64,PHNjcmlwdD4=')).toBe(false);
    expect(isAllowedLinkHref('//evil.example/path')).toBe(false);
    expect(isAllowedLinkHref('\\\\evil.example/path')).toBe(false);
  });

  it('허용된 bitmap data URL과 외부 이미지 URL을 유지한다', () => {
    expect(isAllowedImageSrc('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isAllowedImageSrc('https://cdn.example.com/a.png')).toBe(true);
    expect(isAllowedImageSrc('BLOB:https://consumer.example/image-id')).toBe(true);
  });

  it('SVG data URL과 허용되지 않은 이미지 protocol을 거부한다', () => {
    expect(isAllowedImageSrc('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(isAllowedImageSrc('javascript:alert(1)')).toBe(false);
    expect(isAllowedImageSrc('java\tscript:alert(1)')).toBe(false);
    expect(isAllowedImageSrc('//evil.example/a.png')).toBe(false);
  });
});
