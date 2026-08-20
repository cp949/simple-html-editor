import { Editor, type JSONContent } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';

import { isEditorDocumentEmpty } from '../src/empty-document';
import { createHtmlEditorExtensions } from '../src/extensions';

const editors: Editor[] = [];

function documentFromHtml(html: string): JSONContent {
  const editor = new Editor({
    content: html,
    extensions: createHtmlEditorExtensions(),
  });
  editors.push(editor);

  return editor.getJSON();
}

afterEach(() => {
  for (const editor of editors.splice(0)) {
    editor.destroy();
  }
});

describe('의미 있는 빈 문서 판정', () => {
  it('빈 문단과 공백뿐인 문서를 비었다고 판정한다', () => {
    expect(isEditorDocumentEmpty({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(true);
    expect(
      isEditorDocumentEmpty({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: ' \n\t ' }] }],
      }),
    ).toBe(true);
  });

  it('공백이 아닌 텍스트가 있으면 비어 있지 않다고 판정한다', () => {
    expect(
      isEditorDocumentEmpty({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '내용' }] }],
      }),
    ).toBe(false);
  });

  it('Tiptap이 파싱한 이미지는 텍스트가 없어도 비어 있지 않다고 판정한다', () => {
    const imageDocument = documentFromHtml(
      '<img src="https://cdn.example.com/a.png" alt="이미지">',
    );

    expect(isEditorDocumentEmpty(imageDocument)).toBe(false);
  });

  it('Tiptap이 파싱한 표는 cell이 비어 있어도 비어 있지 않다고 판정한다', () => {
    const tableDocument = documentFromHtml(
      '<table><tbody><tr><td><p></p></td></tr></tbody></table>',
    );

    expect(isEditorDocumentEmpty(tableDocument)).toBe(false);
  });
});
