import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';

import { createHtmlEditorExtensions } from '../src/extensions';

const editors: Editor[] = [];

function roundTrip(html: string): string {
  const editor = new Editor({
    content: html,
    extensions: createHtmlEditorExtensions(),
  });
  editors.push(editor);

  return editor.getHTML();
}

afterEach(() => {
  for (const editor of editors.splice(0)) {
    editor.destroy();
  }
});

describe('HTML round-trip', () => {
  it('위험 source를 모두 제거하면서 안전 본문은 보존한다', () => {
    const source = `
      <p onclick="alert('event')" style="color: #0047b2; background-image: url(https://evil.example/a); font-size: 72px">안전 본문</p>
      <a href="javascript:alert('link')">위험 링크</a>
      <script type="text/plain">alert('script')</script>
    `;

    expect(source).toContain('<script');
    expect(source).toContain('onclick');
    expect(source).toContain('javascript:');
    expect(source).toContain('background-image');
    expect(source).toContain('font-size');

    const output = roundTrip(source);

    expect(output).toContain('안전 본문');
    expect(output).not.toContain('<script');
    expect(output).not.toContain('onclick');
    expect(output).not.toContain('javascript:');
    expect(output).not.toContain('background-image');
    expect(output).not.toContain('font-size');
  });

  it('소비자 형태의 본문을 보존하고 실행 가능한 HTML을 제거한다', () => {
    const intro = `
      <div class="legacy" onclick="alert('container')">
        <p>음성인식(STT)은 <strong onclick="alert('strong')">음성을</strong>
          <span style="color: #0047b2; background-image: url(https://evil.example/a)">텍스트로 바꿉니다.</span>
        </p>
        <script type="text/plain">alert('script')</script>
      </div>
    `;

    const output = roundTrip(intro);

    expect(output).toContain('음성인식(STT)');
    expect(output).toContain('<strong>음성을</strong>');
    expect(output).toMatch(/color:\s*(?:rgb\(0,\s*71,\s*178\)|#0047b2)/i);
    expect(output).not.toContain('onclick');
    expect(output).not.toContain('<script');
    expect(output).not.toContain('background-image');
    expect(output).not.toContain('class="legacy"');
  });

  it('유효하지 않은 후행 color 선언보다 앞선 유효 값을 보존한다', () => {
    const output = roundTrip(
      '<p><span style="color: red; color: not-a-color">invalid fallback</span></p>',
    );

    expect(output).toMatch(
      /<span style="color:\s*(?:red|rgb\(255,\s*0,\s*0\));?">invalid fallback<\/span>/i,
    );
  });

  it('!important color 선언을 후행 일반 선언보다 우선한다', () => {
    const output = roundTrip(
      '<p><span style="color: red !important; color: blue">important wins</span></p>',
    );

    expect(output).toMatch(
      /<span style="color:\s*(?:red|rgb\(255,\s*0,\s*0\));?">important wins<\/span>/i,
    );
    expect(output).not.toMatch(/color:\s*(?:blue|rgb\(0,\s*0,\s*255\))/i);
  });

  it('지원하는 block과 inline 서식을 round-trip한다', () => {
    const output = roundTrip(`
      <h1>제목 1</h1><h2>제목 2</h2><h3>제목 3</h3><h4>제목 4</h4>
      <p><u>밑줄</u> <s>취소선</s></p>
      <blockquote><p>인용문</p></blockquote>
      <ol><li><p>번호 목록</p></li></ol>
      <ul><li><p>글머리 목록</p></li></ul>
      <p style="text-align: right; font-size: 72px" data-extra="drop">오른쪽</p>
    `);

    expect(output).toContain('<h1>제목 1</h1>');
    expect(output).toContain('<h2>제목 2</h2>');
    expect(output).toContain('<h3>제목 3</h3>');
    expect(output).toContain('<h4>제목 4</h4>');
    expect(output).toContain('<u>밑줄</u>');
    expect(output).toContain('<s>취소선</s>');
    expect(output).toContain('<blockquote><p>인용문</p></blockquote>');
    expect(output).toContain('<ol><li><p>번호 목록</p></li></ol>');
    expect(output).toContain('<ul><li><p>글머리 목록</p></li></ul>');
    expect(output).toMatch(/<p style="text-align:\s*right;?">오른쪽<\/p>/);
    expect(output).not.toContain('font-size');
    expect(output).not.toContain('data-extra');
  });

  it('안전한 링크와 이미지만 허용된 속성으로 round-trip한다', () => {
    const output = roundTrip(`
      <p>
        <a href="https://consumer.example/help" target="_self" onclick="alert(1)" data-extra="drop">도움말</a>
        <a href="javascript:alert(1)">위험 링크</a>
      </p>
      <img src="https://cdn.example.com/a.png" alt="안전 이미지" width="800" onclick="alert(1)">
      <img src="data:image/png;base64,iVBORw0KGgo=" alt="붙여넣은 이미지">
      <img src="data:image/svg+xml;base64,PHN2Zz4=" alt="위험 이미지">
    `);

    expect(output).toContain('<a href="https://consumer.example/help">도움말</a>');
    expect(output).toContain('위험 링크');
    expect(output).not.toMatch(/<a[^>]*>위험 링크<\/a>/);
    expect(output).toContain('<img src="https://cdn.example.com/a.png" alt="안전 이미지">');
    expect(output).toContain(
      '<img src="data:image/png;base64,iVBORw0KGgo=" alt="붙여넣은 이미지">',
    );
    expect(output).not.toContain('위험 이미지');
    expect(output).not.toContain('target=');
    expect(output).not.toContain('width=');
    expect(output).not.toContain('onclick');
    expect(output).not.toContain('data-extra');
  });

  it('표의 header와 cell 내용을 round-trip한다', () => {
    const output = roundTrip(`
      <table class="legacy" onclick="alert(1)">
        <thead><tr><th data-extra="drop"><p>제목</p></th></tr></thead>
        <tbody><tr><td style="background: red"><p>내용</p></td></tr></tbody>
      </table>
    `);

    expect(output).toContain('<table');
    expect(output).toMatch(/<th(?:\s[^>]*)?><p>제목<\/p><\/th>/);
    expect(output).toMatch(/<td(?:\s[^>]*)?><p>내용<\/p><\/td>/);
    expect(output).not.toContain('class="legacy"');
    expect(output).not.toContain('onclick');
    expect(output).not.toContain('data-extra');
    expect(output).not.toContain('background: red');
  });
});
