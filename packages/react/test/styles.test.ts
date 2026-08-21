import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const packageRoot = resolve(import.meta.dirname, '..');

describe('simple-html-editor stylesheet', () => {
  it('배포할 stylesheet가 편집기 구조와 접근 가능한 제어용 스타일 계약을 제공한다', async () => {
    const stylesheet = await readFile(resolve(packageRoot, 'src/styles.css'), 'utf8');
    const packageJson = JSON.parse(
      await readFile(resolve(packageRoot, 'package.json'), 'utf8'),
    ) as {
      exports: Record<string, string>;
    };

    expect(stylesheet).toContain('.simple-html-editor');
    expect(stylesheet).toContain('.simple-html-editor__toolbar');
    expect(stylesheet).toContain('.simple-html-editor__content');
    expect(stylesheet).toContain('.simple-html-editor__image-resize-handle');
    expect(stylesheet).toMatch(/\.simple-html-editor__toolbar\s*\{[^}]*flex-wrap\s*:\s*wrap/s);
    expect(stylesheet).toMatch(/\.simple-html-editor__content\s+(?:th|td)[^{]*\{[^}]*border/s);
    expect(stylesheet).toMatch(/button:focus-visible[^}]*outline/s);
    expect(stylesheet).toMatch(
      /\.simple-html-editor__toolbar button\s*\{[^}]*align-items\s*:\s*center/s,
    );
    expect(stylesheet).toMatch(/\.simple-html-editor__toolbar button svg\s*\{[^}]*width\s*:/s);
    expect(stylesheet).toMatch(/\.simple-html-editor__toolbar button svg\s*\{[^}]*height\s*:/s);
    expect(stylesheet).toMatch(/\.simple-html-editor__content\s*\{[^}]*overflow-y\s*:\s*auto/s);
    expect(stylesheet).toMatch(/\.simple-html-editor__toolbar\s*>\s*\*\s*\{[^}]*margin/s);
    expect(stylesheet).toMatch(/\.simple-html-editor button:focus\s*,[^}]*outline/s);
    expect(stylesheet).toMatch(/\.simple-html-editor button:focus-visible\s*,[^}]*outline/s);
    expect(stylesheet).not.toContain('color-mix(');
    expect(packageJson.exports['./styles.css']).toBe('./src/styles.css');

    const variables = [
      '--simple-html-editor-border-color',
      '--simple-html-editor-background',
      '--simple-html-editor-foreground',
      '--simple-html-editor-min-height',
      '--simple-html-editor-max-height',
    ];
    const definedVariables = new Set(
      [...stylesheet.matchAll(/^\s*(--simple-html-editor-[\w-]+)\s*:/gm)].map((match) => match[1]),
    );

    expect(definedVariables).toEqual(new Set(variables));
  });
});
