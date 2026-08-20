import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('demo stylesheet', () => {
  it('flex gap 없이 action spacing과 keyboard focus outline을 유지한다', async () => {
    const stylesheet = await readFile(resolve(import.meta.dirname, 'app.css'), 'utf8');

    expect(stylesheet).toMatch(/\.demo-page__actions\s*>\s*button\s*\{[^}]*margin/s);
    expect(stylesheet).toMatch(/\.demo-page__actions button:focus\s*\{[^}]*outline/s);
    expect(stylesheet).toMatch(/\.demo-page__actions button:focus-visible\s*\{[^}]*outline/s);
  });
});
