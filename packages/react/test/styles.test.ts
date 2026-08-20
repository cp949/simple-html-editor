import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const packageRoot = resolve(import.meta.dirname, '..');

describe('editor-simple stylesheet', () => {
  it('배포할 stylesheet가 편집기 구조와 접근 가능한 제어용 스타일 계약을 제공한다', async () => {
    const stylesheet = await readFile(resolve(packageRoot, 'src/styles.css'), 'utf8');
    const packageJson = JSON.parse(
      await readFile(resolve(packageRoot, 'package.json'), 'utf8'),
    ) as {
      exports: Record<string, string>;
    };

    expect(stylesheet).toContain('.editor-simple');
    expect(stylesheet).toContain('.editor-simple__toolbar');
    expect(stylesheet).toContain('.editor-simple__content');
    expect(stylesheet).toContain('.editor-simple__image-resize-handle');
    expect(stylesheet).toMatch(/\.editor-simple__toolbar\s*\{[^}]*flex-wrap\s*:\s*wrap/s);
    expect(stylesheet).toMatch(/\.editor-simple__content\s+(?:th|td)[^{]*\{[^}]*border/s);
    expect(stylesheet).toMatch(/button:focus-visible[^}]*outline/s);
    expect(stylesheet).toMatch(/\.editor-simple__content\s*\{[^}]*overflow-y\s*:\s*auto/s);
    expect(stylesheet).toMatch(/\.editor-simple__toolbar\s*>\s*\*\s*\{[^}]*margin/s);
    expect(stylesheet).toMatch(/\.editor-simple button:focus\s*,[^}]*outline/s);
    expect(stylesheet).toMatch(/\.editor-simple button:focus-visible\s*,[^}]*outline/s);
    expect(stylesheet).not.toContain('color-mix(');
    expect(packageJson.exports['./styles.css']).toBe('./src/styles.css');

    const variables = [
      '--editor-simple-border-color',
      '--editor-simple-background',
      '--editor-simple-foreground',
      '--editor-simple-min-height',
      '--editor-simple-max-height',
    ];
    const definedVariables = new Set(
      [...stylesheet.matchAll(/^\s*(--editor-simple-[\w-]+)\s*:/gm)].map((match) => match[1]),
    );

    expect(definedVariables).toEqual(new Set(variables));
  });
});
