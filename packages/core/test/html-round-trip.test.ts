import { Editor, type JSONContent } from '@tiptap/core';
import { undoDepth } from '@tiptap/pm/history';
import { NodeSelection } from '@tiptap/pm/state';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createHtmlEditorExtensions } from '../src/extensions';
import { selectedImageAlignment } from '../src/image-presentation';

const editors: Editor[] = [];

function roundTrip(html: string): string {
  const editor = createEditor(html);
  editors.push(editor);

  return editor.getHTML();
}

function createEditor(content: string | JSONContent): Editor {
  return new Editor({
    content,
    extensions: createHtmlEditorExtensions(),
  });
}

function parseHtml(html: string): JSONContent {
  const editor = createEditor(html);
  editors.push(editor);

  return editor.getJSON();
}

function imageAttributes(html: string): Record<string, unknown> {
  const image = parseHtml(html).content?.find((node) => node.type === 'image');

  if (!image?.attrs) {
    throw new Error('image node를 찾을 수 없습니다.');
  }

  return image.attrs;
}

function renderedImage(html: string): HTMLImageElement {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const image = document.querySelector('img');

  if (!(image instanceof HTMLImageElement)) {
    throw new Error('정규화 HTML에서 image element를 찾을 수 없습니다.');
  }

  return image;
}

function insertTextAsUser(editor: Editor, text: string): void {
  for (const character of text) {
    const { from, to } = editor.state.selection;
    const handled = editor.view.someProp('handleTextInput', (handler) =>
      handler(editor.view, from, to, character, () =>
        editor.state.tr.insertText(character, from, to),
      ),
    );

    if (!handled) {
      editor.view.dispatch(editor.state.tr.insertText(character, from, to));
    }
  }
}

function selectImage(editor: Editor): number {
  let imagePosition: number | null = null;

  editor.state.doc.descendants((node, position) => {
    if (node.type.name === 'image') {
      imagePosition = position;
      return false;
    }

    return true;
  });

  if (imagePosition === null) {
    throw new Error('image node를 찾을 수 없습니다.');
  }

  editor.commands.setNodeSelection(imagePosition);

  return imagePosition;
}

afterEach(() => {
  for (const editor of editors.splice(0)) {
    editor.destroy();
  }
});

describe('HTML round-trip', () => {
  it('주입한 private image NodeView renderer를 같은 image schema에 연결한다', () => {
    const renderer = vi.fn(() => ({ dom: document.createElement('img') }));
    const editor = new Editor({
      content: '<img src="https://cdn.example.com/node-view.png" width="320">',
      extensions: createHtmlEditorExtensions(renderer),
    });
    editors.push(editor);

    expect(renderer).toHaveBeenCalledTimes(1);
    expect(editor.getHTML()).toContain('width="320"');
  });

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
    const images = [
      ...new DOMParser().parseFromString(output, 'text/html').querySelectorAll('img'),
    ];

    expect(images).toHaveLength(2);
    expect(images[0]?.getAttribute('src')).toBe('https://cdn.example.com/a.png');
    expect(images[0]?.getAttribute('alt')).toBe('안전 이미지');
    expect(images[0]?.getAttribute('width')).toBe('800');
    expect(images[1]?.getAttribute('src')).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(images[1]?.getAttribute('alt')).toBe('붙여넣은 이미지');
    expect(images[1]?.hasAttribute('width')).toBe(false);
    expect(output).not.toContain('위험 이미지');
    expect(output).not.toContain('target=');
    expect(output).not.toContain('onclick');
    expect(output).not.toContain('data-extra');
    expect(
      parseHtml('<img src="data:image/svg+xml;base64,PHN2Zz4=" alt="위험 이미지">').content?.some(
        (node) => node.type === 'image',
      ),
    ).toBe(false);
  });

  it('이미지 alt의 부재, 빈 문자열과 텍스트를 구분하고 기본 presentation을 읽는다', () => {
    expect(imageAttributes('<img src="https://cdn.example.com/default.png">')).toEqual({
      src: 'https://cdn.example.com/default.png',
      alt: null,
      width: null,
      alignment: 'left',
    });
    expect(imageAttributes('<img src="https://cdn.example.com/empty.png" alt="">').alt).toBe('');
    expect(imageAttributes('<img src="https://cdn.example.com/text.png" alt="설명">').alt).toBe(
      '설명',
    );
  });

  it.each(['javascript:alert(1)', '', 'data:image/svg+xml;base64,PHN2Zz4='])(
    'setImage command가 무효 source %s를 문서 변경 없이 거부한다',
    (src) => {
      const editor = createEditor('<p>기존 본문</p>');
      editors.push(editor);
      const beforeJson = editor.getJSON();
      const beforeHtml = editor.getHTML();

      expect(editor.commands.setImage({ src })).toBe(false);
      expect(editor.getJSON()).toEqual(beforeJson);
      expect(editor.getHTML()).toBe(beforeHtml);
    },
  );

  it.each([
    ['HTTP', 'https://cdn.example.com/command.png', '설명'],
    ['bitmap data', 'data:image/png;base64,iVBORw0KGgo=', ''],
  ])('setImage command가 유효한 %s source와 허용 attribute만 저장한다', (_caseName, src, alt) => {
    const editor = createEditor('');
    editors.push(editor);

    expect(
      editor.commands.setImage({
        src,
        alt,
        title: 'drop',
        width: 640,
        height: 480,
      }),
    ).toBe(true);

    const image = editor.getJSON().content?.find((node) => node.type === 'image');

    expect(image?.attrs).toEqual({
      src,
      alt,
      width: null,
      alignment: 'left',
    });
    expect(renderedImage(editor.getHTML()).getAttribute('src')).toBe(src);
  });

  it('markdown 이미지 입력 문법을 image node로 변환하지 않는다', () => {
    const editor = createEditor('');
    editors.push(editor);
    const markdown = '![설명](https://cdn.example.com/input-rule.png)';

    insertTextAsUser(editor, markdown);

    expect(editor.getJSON()).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { textAlign: null },
          content: [{ type: 'text', text: markdown }],
        },
      ],
    });
    expect(editor.getHTML()).not.toContain('<img');
  });

  it('무효 source를 가진 runtime JSON image node를 img로 render하지 않는다', () => {
    const editor = createEditor({
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: {
            src: 'javascript:alert(1)',
            alt: '위험 이미지',
            width: 320,
            alignment: 'center',
          },
        },
      ],
    });
    editors.push(editor);

    expect(editor.getJSON().content?.[0]?.type).toBe('image');
    expect(editor.getHTML()).not.toContain('<img');
  });

  it.each([
    ['1', 1],
    ['32', 32],
    ['10000', 10000],
  ])('유효한 width attribute %s를 숫자로 읽는다', (width, expected) => {
    expect(
      imageAttributes(`<img src="https://cdn.example.com/image.png" width="${width}">`),
    ).toMatchObject({
      width: expected,
    });
  });

  it.each(['0', '01', '+32', '-32', '32.0', '1e2', '32px', ' 32 ', '10001'])(
    '무효한 width attribute %s를 null로 정규화한다',
    (width) => {
      expect(
        imageAttributes(`<img src="https://cdn.example.com/image.png" width="${width}">`),
      ).toMatchObject({
        width: null,
      });
    },
  );

  it.each([
    ['margin-left: 0; margin-right: auto', 'left'],
    ['margin-left: auto; margin-right: auto', 'center'],
    ['margin-left: auto; margin-right: 0', 'right'],
    ['MARGIN-LEFT: 0PX; MARGIN-RIGHT: AUTO', 'left'],
    ['margin-left: auto; margin-right: 0px', 'right'],
    ['m\\61 rgin-left: auto; margin-right: auto', 'center'],
    [
      `background: url('https://cdn.example.com/a; margin-left: 0; margin-right: auto'); margin-left: auto; margin-right: auto`,
      'center',
    ],
    ['background: url(foo{bar); margin-left: auto; margin-right: auto', 'center'],
    ['background: url(foo[bar); margin-left: auto; margin-right: auto', 'center'],
    ['background: url(foo&quot;bar); margin-left: auto; margin-right: auto', 'center'],
    ["background: url(foo'bar); margin-left: auto; margin-right: auto", 'center'],
    ['background: \\(; margin-left: auto; margin-right: auto', 'center'],
    ['background: \\); margin-left: auto; margin-right: auto', 'center'],
    ['background: \\\\; margin-left: auto; margin-right: auto', 'center'],
    ['background: \\\\); margin-left: auto; margin-right: auto', 'center'],
    ['/*:*/ margin-left: auto; margin-right: auto', 'center'],
    ['margin-left: auto; /*:*/ margin-right: auto', 'center'],
    ['margin-left: auto; margin-right: auto/*:*/', 'center'],
    ['margin-left: auto; margin-right: auto/*', 'center'],
  ])('허용된 margin longhand %s를 %s alignment로 읽는다', (style, alignment) => {
    expect(
      imageAttributes(`<img src="https://cdn.example.com/image.png" style="${style}">`),
    ).toMatchObject({ alignment });
  });

  it.each([
    'margin-left: 0',
    'margin-right: auto',
    'margin: 0 auto',
    'margin-left: 1px; margin-right: auto',
    'margin-left: 10%; margin-right: auto',
    'margin-left: -1px; margin-right: auto',
    'margin-left: calc(0px); margin-right: auto',
    'margin-left: var(--left); margin-right: auto',
    'margin-left: 0; margin-right: 0',
    'margin-left: auto; margin-right: 1px',
    'margin-left: not-a-margin; margin-right: not-a-margin; margin: 0 auto',
    'margin-left: not-a-margin; margin-right: not-a-margin; margin: 0 0 0 auto',
    '/*:*/ margin-left: not-a-margin; margin-right: auto',
    '/*:*/ margin-left: not-a-margin; margin-right: not-a-margin; margin: 0 auto',
    'margin-left:auto; margin-right:auto; background:url(foo/*); margin:0',
    'background: url(/**/&quot;foo)bar&quot;); margin-left: auto; margin-right: auto',
    'background: \\; margin-left: auto; margin-right: auto',
    'background: \\\\(; margin-left: auto; margin-right: auto',
    '--presentation: [fallback; margin-left: auto; margin-right: auto; ]',
    '--presentation: {fallback; margin-left: auto; margin-right: auto; }',
  ])('판정할 수 없는 style %s를 left alignment로 정규화한다', (style) => {
    expect(
      imageAttributes(`<img src="https://cdn.example.com/image.png" style="${style}">`),
    ).toMatchObject({ alignment: 'left' });
  });

  it.each([
    ['margin-left: 0; margin-left: auto !important; margin-right: auto', 'center'],
    ['margin-left: auto !important; margin-left: 0; margin-right: auto', 'center'],
    ['margin-left: auto; margin-right: 0; margin-right: auto !important', 'center'],
  ])('중복 margin longhand의 CSSOM 최종값 %s를 %s alignment로 읽는다', (style, alignment) => {
    expect(
      imageAttributes(`<img src="https://cdn.example.com/image.png" style="${style}">`),
    ).toMatchObject({ alignment });
  });

  it('이미지 render가 allowlist와 고정 style만 저장한다', () => {
    const image = renderedImage(
      roundTrip(
        '<img src="https://cdn.example.com/image.png" alt="설명" width="320" title="drop" height="90" class="drop" data-extra="drop" onclick="alert(1)" style="width: 50%; min-width: 10px; margin: 1px; margin-left: auto; margin-right: auto; color: red">',
      ),
    );
    const document = new DOMParser().parseFromString(
      roundTrip(
        '<img src="https://cdn.example.com/image.png" alt="설명" width="320" title="drop" height="90" class="drop" data-extra="drop" onclick="alert(1)" style="width: 50%; min-width: 10px; margin: 1px; margin-left: auto; margin-right: auto; color: red">',
      ),
      'text/html',
    );

    expect(document.body.children).toHaveLength(1);
    expect(document.body.firstElementChild?.tagName).toBe('IMG');
    expect(image.getAttribute('src')).toBe('https://cdn.example.com/image.png');
    expect(image.getAttribute('alt')).toBe('설명');
    expect(image.getAttribute('width')).toBe('320');
    expect(image.getAttribute('title')).toBeNull();
    expect(image.getAttribute('height')).toBeNull();
    expect(image.getAttribute('class')).toBeNull();
    expect(image.getAttribute('data-extra')).toBeNull();
    expect(image.getAttribute('onclick')).toBeNull();
    expect(image.style.getPropertyValue('display')).toBe('block');
    expect(image.style.getPropertyValue('max-width')).toBe('100%');
    expect(image.style.getPropertyValue('height')).toBe('auto');
    expect(image.style.getPropertyValue('margin-left')).toBe('auto');
    expect(image.style.getPropertyValue('margin-right')).toBe('auto');
    expect(image.style.getPropertyValue('width')).toBe('');
    expect(image.style.getPropertyValue('min-width')).toBe('');
    expect(image.style.getPropertyValue('margin')).toBe('');
    expect(image.style.getPropertyValue('color')).toBe('');
  });

  it.each([
    ['alt=null, width=null', '<img src="https://cdn.example.com/nulls.png">', null, null, false],
    [
      'empty alt, width=null',
      '<img src="https://cdn.example.com/empty.png" alt="">',
      '',
      null,
      false,
    ],
    [
      'alt=null, width=32',
      '<img src="https://cdn.example.com/width.png" width="32">',
      null,
      '32',
      true,
    ],
  ])('image render가 %s attribute 의미를 보존한다', (_caseName, source, alt, width, hasWidth) => {
    const image = renderedImage(roundTrip(source));

    expect(image.getAttribute('alt')).toBe(alt);
    expect(image.getAttribute('width')).toBe(width);
    expect(image.hasAttribute('width')).toBe(hasWidth);
  });

  it.each([
    ['left', null, 'margin-left: 0; margin-right: auto'],
    ['center', 320, 'margin-left: auto; margin-right: auto'],
    ['right', 640, 'margin-left: auto; margin-right: 0'],
  ])(
    'image parse-render-parse가 %s/%s presentation fixed point를 유지한다',
    (alignment, width, style) => {
      const source = `<img src="https://cdn.example.com/image.png" alt="설명"${width === null ? '' : ` width="${width}"`} style="${style}">`;
      const first = imageAttributes(source);
      const second = imageAttributes(roundTrip(source));

      expect(first.alignment).toBe(alignment);
      expect(second).toEqual(first);
    },
  );

  it('image NodeSelection에서만 alignment를 바꾸고 presentation과 selection을 보존한다', () => {
    const editor = createEditor(
      '<p>본문</p><img src="https://cdn.example.com/command.png" alt="설명" width="320">',
    );
    editors.push(editor);
    const imagePosition = selectImage(editor);
    const before = editor.getAttributes('image');
    const selection = { from: editor.state.selection.from, to: editor.state.selection.to };

    expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    expect(editor.can().setImageAlignment('center')).toBe(true);
    expect(editor.commands.setImageAlignment('center')).toBe(true);
    expect(editor.getAttributes('image')).toEqual({ ...before, alignment: 'center' });
    expect(editor.state.selection).toMatchObject(selection);
    expect(editor.state.selection.from).toBe(imagePosition);
  });

  it('selectedImageAlignment는 image NodeSelection에서만 현재 alignment를 알린다', () => {
    const editor = createEditor(
      '<table><tbody><tr><td><p>문단</p></td><td><img src="https://cdn.example.com/selection.png" style="margin-left: auto; margin-right: auto"></td></tr></tbody></table>',
    );
    editors.push(editor);
    const cellPositions: number[] = [];
    let imagePosition = -1;

    editor.state.doc.descendants((node, position) => {
      if (node.type.name === 'tableCell') {
        cellPositions.push(position);
      }

      if (node.type.name === 'image') {
        imagePosition = position;
      }

      return true;
    });

    expect(selectedImageAlignment(editor.state)).toBeNull();

    editor.commands.setCellSelection({
      anchorCell: cellPositions[0],
      headCell: cellPositions[1],
    });

    // head 셀 내용이 image 하나뿐이면 CellSelection 범위가 image node와 겹친다.
    expect(editor.state.selection.from).toBe(imagePosition);
    expect(selectedImageAlignment(editor.state)).toBeNull();

    selectImage(editor);

    expect(selectedImageAlignment(editor.state)).toBe('center');
  });

  it('같은 image alignment는 transaction과 update event 없이 성공하는 no-op이다', () => {
    const editor = createEditor('<img src="https://cdn.example.com/no-op.png">');
    editors.push(editor);
    selectImage(editor);
    const beforeUndoDepth = undoDepth(editor.state);
    let transactions = 0;
    let updates = 0;

    editor.on('transaction', () => {
      transactions += 1;
    });
    editor.on('update', () => {
      updates += 1;
    });

    expect(editor.can().setImageAlignment('left')).toBe(true);
    expect(editor.commands.setImageAlignment('left')).toBe(true);
    expect(transactions).toBe(0);
    expect(updates).toBe(0);
    expect(undoDepth(editor.state)).toBe(beforeUndoDepth);
  });

  it('같은 image alignment 뒤의 다른 alignment를 하나의 transaction과 undo step으로 적용한다', () => {
    const editor = createEditor('<img src="https://cdn.example.com/chained-alignment.png">');
    editors.push(editor);
    selectImage(editor);
    const beforeUndoDepth = undoDepth(editor.state);
    let transactions = 0;
    let updates = 0;

    editor.on('transaction', () => {
      transactions += 1;
    });
    editor.on('update', () => {
      updates += 1;
    });

    expect(editor.chain().setImageAlignment('left').setImageAlignment('right').run()).toBe(true);
    expect(editor.getAttributes('image').alignment).toBe('right');
    expect(transactions).toBe(1);
    expect(updates).toBe(1);
    expect(undoDepth(editor.state)).toBe(beforeUndoDepth + 1);

    expect(editor.commands.undo()).toBe(true);
    expect(editor.getAttributes('image').alignment).toBe('left');
    expect(transactions).toBe(2);
    expect(updates).toBe(2);
    expect(undoDepth(editor.state)).toBe(beforeUndoDepth);
  });

  it('같은 image alignment 뒤의 다른 문서 변경을 transaction과 undo step으로 적용한다', () => {
    const editor = createEditor('<img src="https://cdn.example.com/chained-mutation.png">');
    editors.push(editor);
    selectImage(editor);
    const before = editor.getHTML();
    const beforeUndoDepth = undoDepth(editor.state);
    let transactions = 0;
    let updates = 0;

    editor.on('transaction', () => {
      transactions += 1;
    });
    editor.on('update', () => {
      updates += 1;
    });

    expect(
      editor
        .chain()
        .setImageAlignment('left')
        .insertContentAt(editor.state.doc.content.size, '<p>후속 변경</p>')
        .run(),
    ).toBe(true);
    expect(editor.getHTML()).toContain('<p>후속 변경</p>');
    expect(transactions).toBe(1);
    expect(updates).toBe(1);
    expect(undoDepth(editor.state)).toBe(beforeUndoDepth + 1);

    expect(editor.commands.undo()).toBe(true);
    expect(editor.getHTML()).toBe(before);
    expect(transactions).toBe(2);
    expect(updates).toBe(2);
    expect(undoDepth(editor.state)).toBe(beforeUndoDepth);
  });

  it('text selection, 무효 alignment와 non-editable image selection에서 document 변경 없이 거부한다', () => {
    const editor = createEditor(
      '<p>본문</p><img src="https://cdn.example.com/reject.png" alt="설명" width="320">',
    );
    editors.push(editor);

    editor.commands.setTextSelection(1);

    expect(editor.can().setImageAlignment('center')).toBe(false);
    expect(editor.commands.setImageAlignment('center')).toBe(false);

    selectImage(editor);
    const beforeInvalidAlignment = editor.getJSON();

    expect(editor.commands.setImageAlignment('justify' as never)).toBe(false);
    expect(editor.getJSON()).toEqual(beforeInvalidAlignment);

    editor.setEditable(false, false);
    const beforeNonEditable = editor.getJSON();

    expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    expect(editor.commands.setImageAlignment('right')).toBe(false);
    expect(editor.getJSON()).toEqual(beforeNonEditable);
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
