import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createHtmlEditorExtensions } from '@cp949/simple-html-editor-core';
import type { Editor } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HtmlEditor } from '../src';
import { Toolbar } from '../src/Toolbar';

/** 텍스트 표현을 유지하는 toolbar control */
const textOnlyLabels = ['문단', '제목 1', '제목 2', '제목 3', '제목 4'] as const;

/** 아이콘만 표시하는 toolbar control과 승인된 Lucide 이름 */
const iconOnlyControls = {
  굵게: 'bold',
  기울임: 'italic',
  밑줄: 'underline',
  취소선: 'strikethrough',
  인용구: 'text-quote',
  '번호 목록': 'list-ordered',
  '글머리 목록': 'list',
  들여쓰기: 'list-indent-increase',
  내어쓰기: 'list-indent-decrease',
  '왼쪽 정렬': 'text-align-start',
  '가운데 정렬': 'text-align-center',
  '오른쪽 정렬': 'text-align-end',
  '이미지 왼쪽 정렬': 'align-start-vertical',
  '이미지 가운데 정렬': 'align-center-vertical',
  '이미지 오른쪽 정렬': 'align-end-vertical',
  '링크 설정': 'link',
  '링크 제거': 'unlink',
  '이미지 추가': 'image-plus',
  '글자색 제거': 'droplet-off',
  '서식 지우기': 'remove-formatting',
  '표 삽입': 'table',
} as const;

/** 표 밖 selection에서 렌더링하는 toolbar 버튼의 DOM 순서 */
const defaultToolbarLabels = [
  '문단',
  '제목 1',
  '제목 2',
  '제목 3',
  '제목 4',
  '굵게',
  '기울임',
  '밑줄',
  '취소선',
  '인용구',
  '번호 목록',
  '글머리 목록',
  '들여쓰기',
  '내어쓰기',
  '왼쪽 정렬',
  '가운데 정렬',
  '오른쪽 정렬',
  '이미지 왼쪽 정렬',
  '이미지 가운데 정렬',
  '이미지 오른쪽 정렬',
  '링크 설정',
  '링크 제거',
  '이미지 추가',
  '글자색 제거',
  '서식 지우기',
  '표 삽입',
] as const;

function getTextNode(element: HTMLElement, selector: string): Text {
  const textNode = element.querySelector(selector)?.firstChild;

  if (!(textNode instanceof Text)) {
    throw new Error(`${selector}의 텍스트를 찾을 수 없습니다.`);
  }

  return textNode;
}

/** 렌더링된 텍스트와 같은 실제 ProseMirror 문서 범위를 선택한다. */
function selectText(
  editor: Editor,
  fromNode: Text,
  from = 0,
  toNode = fromNode,
  to = toNode.length,
): void {
  let fromPosition: number | undefined;
  let toPosition: number | undefined;

  editor.state.doc.descendants((node, position) => {
    if (!node.isText) {
      return;
    }

    if (node.text === fromNode.data && fromPosition === undefined) {
      fromPosition = position + from;
    }

    if (node.text === toNode.data && toPosition === undefined) {
      toPosition = position + to;
    }
  });

  if (fromPosition === undefined || toPosition === undefined) {
    throw new Error('선택할 편집기 텍스트를 찾을 수 없습니다.');
  }

  const selection = { from: fromPosition, to: toPosition };

  act(() => {
    editor.commands.focus();
    editor.commands.setTextSelection(selection);
  });
}

/** 편집기 안의 첫 문단 텍스트를 선택한다. */
function selectParagraphText(editor: Editor, editorElement: HTMLElement): void {
  selectText(editor, getTextNode(editorElement, 'p'));
}

/** 편집기 전체의 첫 텍스트부터 마지막 텍스트까지 선택한다. */
function selectAllText(editor: Editor, editorElement: HTMLElement): void {
  const textNodes = Array.from(editorElement.querySelectorAll('p')).map(
    (paragraph) => paragraph.firstChild as Text,
  );
  const firstTextNode = textNodes[0];
  const lastTextNode = textNodes[textNodes.length - 1];
  if (!firstTextNode || !lastTextNode) {
    throw new Error('전체 선택에 필요한 편집기 텍스트를 찾을 수 없습니다.');
  }
  selectText(editor, firstTextNode, 0, lastTextNode);
}

/** 편집기 문서의 첫 image node를 정확히 NodeSelection으로 선택한다. */
function selectImage(editor: Editor): number {
  let imagePosition: number | undefined;

  editor.state.doc.descendants((node, position) => {
    if (node.type.name === 'image' && imagePosition === undefined) {
      imagePosition = position;
    }
  });

  if (imagePosition === undefined) {
    throw new Error('선택할 image node를 찾을 수 없습니다.');
  }
  const selectedImagePosition = imagePosition;

  act(() => {
    editor.commands.setNodeSelection(selectedImagePosition);
  });

  return selectedImagePosition;
}

/** 내부 Toolbar가 실제 Tiptap 문서를 조작하도록 렌더링한다. */
function ToolbarHarness({
  value,
  onEditor,
  readOnly = false,
}: {
  value: string;
  onEditor: (editor: Editor) => void;
  readOnly?: boolean;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: createHtmlEditorExtensions(),
    content: value,
    editable: !readOnly,
  });

  useEffect(() => {
    if (editor) {
      onEditor(editor);
    }
  }, [editor, onEditor]);

  return editor ? (
    <>
      <Toolbar editor={editor} readOnly={readOnly} />
      <EditorContent editor={editor} />
    </>
  ) : null;
}

/** Toolbar와 실제 editor를 함께 준비한다. */
async function renderToolbar(
  value: string,
  readOnly = false,
): Promise<{ editor: Editor; element: HTMLElement }> {
  let resolvedEditor: Editor | undefined;
  render(
    <ToolbarHarness
      value={value}
      readOnly={readOnly}
      onEditor={(editor) => {
        resolvedEditor = editor;
      }}
    />,
  );
  const element = await screen.findByRole('textbox');
  await waitFor(() => expect(resolvedEditor).toBeDefined());

  if (!resolvedEditor) {
    throw new Error('Toolbar editor를 준비하지 못했습니다.');
  }

  return { editor: resolvedEditor, element };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HtmlEditor toolbar', () => {
  it('readOnly이면 모든 toolbar control이 비활성이고 문서를 바꾸지 않는다', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<HtmlEditor value="<p>읽기 전용</p>" onChange={onChange} />);
    const editor = await screen.findByRole('textbox');
    const commandLabels = [
      '문단',
      '제목 1',
      '제목 2',
      '제목 3',
      '제목 4',
      '굵게',
      '기울임',
      '밑줄',
      '취소선',
      '인용구',
      '번호 목록',
      '글머리 목록',
      '들여쓰기',
      '내어쓰기',
      '왼쪽 정렬',
      '가운데 정렬',
      '오른쪽 정렬',
      '이미지 왼쪽 정렬',
      '이미지 가운데 정렬',
      '이미지 오른쪽 정렬',
      '링크 설정',
      '링크 제거',
      '글자색 제거',
      '서식 지우기',
    ];
    const before = editor.innerHTML;

    rerender(<HtmlEditor value="<p>읽기 전용</p>" onChange={onChange} readOnly />);

    await waitFor(() => {
      for (const label of commandLabels) {
        expect(screen.getByRole('button', { name: label })).toBeDisabled();
      }
      expect(screen.getByLabelText('글자색')).toBeDisabled();
    });
    onChange.mockClear();

    for (const label of commandLabels) {
      fireEvent.click(screen.getByRole('button', { name: label }));
    }
    fireEvent.change(screen.getByLabelText('글자색'), { target: { value: '#ff0000' } });

    expect(editor.innerHTML).toBe(before);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('기본 문단은 왼쪽 정렬을 활성으로 알리고 가운데 정렬 후 상태를 갱신한다', async () => {
    render(<HtmlEditor value="<p>기본 정렬</p>" onChange={vi.fn()} />);
    const editor = await screen.findByRole('textbox');

    expect(screen.getByRole('button', { name: '왼쪽 정렬' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '가운데 정렬' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: '오른쪽 정렬' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    fireEvent.click(screen.getByRole('button', { name: '가운데 정렬' }));

    await waitFor(() => expect(editor.querySelector('p')).toHaveStyle({ textAlign: 'center' }));
    expect(screen.getByRole('button', { name: '왼쪽 정렬' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: '가운데 정렬' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '오른쪽 정렬' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('공개 HtmlEditor가 접근 가능한 editor 소유 toolbar를 렌더링한다', async () => {
    render(<HtmlEditor value="<p>도구</p>" onChange={vi.fn()} />);

    expect(await screen.findByRole('toolbar', { name: '서식 도구' })).toBeInTheDocument();
    for (const label of [
      '문단',
      '제목 1',
      '제목 2',
      '제목 3',
      '제목 4',
      '굵게',
      '기울임',
      '밑줄',
      '취소선',
      '인용구',
      '번호 목록',
      '글머리 목록',
      '들여쓰기',
      '내어쓰기',
      '왼쪽 정렬',
      '가운데 정렬',
      '오른쪽 정렬',
      '이미지 왼쪽 정렬',
      '이미지 가운데 정렬',
      '이미지 오른쪽 정렬',
      '링크 설정',
      '링크 제거',
      '글자색 제거',
      '서식 지우기',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByLabelText('글자색')).toHaveAttribute('type', 'color');
  });

  it('문단, 제목, 인라인 서식과 인용구의 실제 문서를 바꾸고 활성 상태를 표시한다', async () => {
    const { editor, element } = await renderToolbar('<p>서식 대상</p>');

    selectParagraphText(editor, element);
    fireEvent.click(screen.getByRole('button', { name: '제목 2' }));
    await waitFor(() => expect(element.innerHTML).toContain('<h2>서식 대상</h2>'));
    expect(screen.getByRole('button', { name: '제목 2' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: '굵게' }));
    await waitFor(() => expect(element.innerHTML).toContain('<strong>서식 대상</strong>'));
    expect(screen.getByRole('button', { name: '굵게' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: '기울임' }));
    await waitFor(() => expect(element.innerHTML).toContain('<em>서식 대상</em>'));
    fireEvent.click(screen.getByRole('button', { name: '밑줄' }));
    await waitFor(() => expect(element.innerHTML).toContain('<u>서식 대상</u>'));
    fireEvent.click(screen.getByRole('button', { name: '취소선' }));
    await waitFor(() => expect(element.querySelector('s')).toHaveTextContent('서식 대상'));

    fireEvent.click(screen.getByRole('button', { name: '문단' }));
    await waitFor(() => expect(element.querySelector('p')).toHaveTextContent('서식 대상'));
    fireEvent.click(screen.getByRole('button', { name: '인용구' }));
    await waitFor(() =>
      expect(element.querySelector('blockquote p')).toHaveTextContent('서식 대상'),
    );
    expect(screen.getByRole('button', { name: '인용구' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('나머지 제목 단계를 실제 heading으로 전환한다', async () => {
    const { editor, element } = await renderToolbar('<p>제목</p>');

    for (const [label, tag] of [
      ['제목 1', 'h1'],
      ['제목 2', 'h2'],
      ['제목 3', 'h3'],
      ['제목 4', 'h4'],
    ] as const) {
      selectText(editor, getTextNode(element, 'h1, h2, h3, h4, p'));
      fireEvent.click(screen.getByRole('button', { name: label }));
      await waitFor(() => expect(element.querySelector(tag)).toHaveTextContent('제목'));
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
    }
  });

  it('목록, 들여쓰기와 내어쓰기가 선택한 문서 구조를 바꾼다', async () => {
    const { editor, element } = await renderToolbar('<p>첫째</p><p>둘째</p>');
    selectAllText(editor, element);

    fireEvent.click(screen.getByRole('button', { name: '글머리 목록' }));
    await waitFor(() =>
      expect(element.innerHTML).toContain('<ul><li><p>첫째</p></li><li><p>둘째</p></li></ul>'),
    );
    expect(screen.getByRole('button', { name: '글머리 목록' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    selectText(editor, element.querySelectorAll('p')[1].firstChild as Text);
    fireEvent.click(screen.getByRole('button', { name: '들여쓰기' }));
    await waitFor(() =>
      expect(element.innerHTML).toContain(
        '<ul><li><p>첫째</p><ul><li><p>둘째</p></li></ul></li></ul>',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: '내어쓰기' }));
    await waitFor(() =>
      expect(element.innerHTML).toContain('<ul><li><p>첫째</p></li><li><p>둘째</p></li></ul>'),
    );

    fireEvent.click(screen.getByRole('button', { name: '번호 목록' }));
    await waitFor(() =>
      expect(element.innerHTML).toContain('<ol><li><p>첫째</p></li><li><p>둘째</p></li></ol>'),
    );
    expect(screen.getByRole('button', { name: '번호 목록' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('정렬 버튼이 선택 문단의 정렬과 활성 상태를 바꾼다', async () => {
    const { editor, element } = await renderToolbar('<p>정렬</p>');
    selectParagraphText(editor, element);

    for (const [label, alignment] of [
      ['왼쪽 정렬', 'left'],
      ['가운데 정렬', 'center'],
      ['오른쪽 정렬', 'right'],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      await waitFor(() => expect(element.querySelector('p')).toHaveStyle({ textAlign: alignment }));
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
    }
  });

  it('제목과 문단에 걸친 selection에서도 문단 정렬을 실행한다', async () => {
    const { editor, element } = await renderToolbar('<h1>제목</h1><p>문단</p>');
    selectText(editor, getTextNode(element, 'h1'), 0, getTextNode(element, 'p'));

    const control = screen.getByRole('button', { name: '가운데 정렬' });

    expect(control).toBeEnabled();
    fireEvent.click(control);

    await waitFor(() => expect(element.querySelector('h1')).toHaveStyle({ textAlign: 'center' }));
    expect(element.querySelector('p')).toHaveStyle({ textAlign: 'center' });
  });

  it('이미지를 가로지르는 text selection에서도 문단 정렬을 실행한다', async () => {
    const { editor, element } = await renderToolbar(
      '<p>앞 문단</p><img src="https://cdn.example.com/toolbar.png" alt="설명" width="320"><p>뒤 문단</p>',
    );
    const paragraphs = element.querySelectorAll('p');
    selectText(editor, paragraphs[0].firstChild as Text, 0, paragraphs[1].firstChild as Text);

    const control = screen.getByRole('button', { name: '오른쪽 정렬' });

    expect(control).toBeEnabled();
    fireEvent.click(control);

    await waitFor(() =>
      expect(element.querySelectorAll('p')[0]).toHaveStyle({ textAlign: 'right' }),
    );
    expect(element.querySelectorAll('p')[1]).toHaveStyle({ textAlign: 'right' });
  });

  it('image 밖 text selection에서는 이미지 정렬이 disabled이고 pressed가 아니다', async () => {
    const { editor, element } = await renderToolbar(
      '<p>문단 정렬</p><img src="https://cdn.example.com/toolbar.png" alt="설명" width="320">',
    );
    selectParagraphText(editor, element);

    for (const label of ['이미지 왼쪽 정렬', '이미지 가운데 정렬', '이미지 오른쪽 정렬']) {
      const control = screen.getByRole('button', { name: label });

      expect(control).toBeDisabled();
      expect(control).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('이미지만 있는 셀을 head로 하는 CellSelection은 이미지 정렬을 pressed로 표시하지 않고 문단 정렬을 막지 않는다', async () => {
    const { editor, element } = await renderToolbar(
      '<table><tbody><tr><td><p>문단</p></td><td><img src="https://cdn.example.com/toolbar.png" alt="설명" width="320"></td></tr></tbody></table>',
    );
    const cellPositions: number[] = [];

    editor.state.doc.descendants((node, position) => {
      if (node.type.name === 'tableCell') {
        cellPositions.push(position);
      }

      return true;
    });

    act(() => {
      editor.commands.setCellSelection({
        anchorCell: cellPositions[0],
        headCell: cellPositions[1],
      });
    });

    for (const label of ['이미지 왼쪽 정렬', '이미지 가운데 정렬', '이미지 오른쪽 정렬']) {
      const control = screen.getByRole('button', { name: label });

      expect(control).toBeDisabled();
      expect(control).toHaveAttribute('aria-pressed', 'false');
    }

    const textAlignment = screen.getByRole('button', { name: '가운데 정렬' });

    expect(textAlignment).toBeEnabled();
    fireEvent.click(textAlignment);

    await waitFor(() => expect(element.querySelector('p')).toHaveStyle({ textAlign: 'center' }));
    expect(editor.getAttributes('image')).toMatchObject({ alignment: 'left', width: 320 });
  });

  it('image NodeSelection에서는 image 정렬만 활성이고 문단 정렬은 실행되지 않는다', async () => {
    const { editor } = await renderToolbar(
      '<p>문단 정렬</p><img src="https://cdn.example.com/toolbar.png" alt="설명" width="320" style="margin-left: auto; margin-right: auto">',
    );
    selectImage(editor);

    for (const [label, pressed] of [
      ['이미지 왼쪽 정렬', false],
      ['이미지 가운데 정렬', true],
      ['이미지 오른쪽 정렬', false],
    ] as const) {
      const control = screen.getByRole('button', { name: label });

      expect(control).toBeEnabled();
      expect(control).toHaveAttribute('aria-pressed', String(pressed));
    }

    for (const label of ['왼쪽 정렬', '가운데 정렬', '오른쪽 정렬']) {
      const control = screen.getByRole('button', { name: label });

      expect(control).toBeDisabled();
      expect(control).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('image 정렬 toolbar 조작은 image selection과 presentation attribute를 보존한다', async () => {
    const { editor } = await renderToolbar(
      '<p>문단 정렬</p><img src="https://cdn.example.com/toolbar.png" alt="설명" width="320">',
    );
    const imagePosition = selectImage(editor);
    const selection = { from: editor.state.selection.from, to: editor.state.selection.to };
    const control = screen.getByRole('button', { name: '이미지 가운데 정렬' });

    fireEvent.mouseDown(control);

    expect(editor.state.selection).toMatchObject(selection);
    expect(editor.state.selection.from).toBe(imagePosition);
    expect(editor.getAttributes('image')).toEqual({
      src: 'https://cdn.example.com/toolbar.png',
      alt: '설명',
      width: 320,
      alignment: 'left',
    });

    fireEvent.click(control);

    await waitFor(() =>
      expect(editor.getAttributes('image')).toEqual({
        src: 'https://cdn.example.com/toolbar.png',
        alt: '설명',
        width: 320,
        alignment: 'center',
      }),
    );
    expect(editor.state.selection).toMatchObject(selection);
    expect(editor.state.selection.from).toBe(imagePosition);
  });

  it('readOnly image selection에서는 image 정렬 control이 문서를 바꾸지 않는다', async () => {
    const { editor } = await renderToolbar(
      '<img src="https://cdn.example.com/toolbar.png" alt="설명" width="320">',
      true,
    );
    selectImage(editor);
    const before = editor.getHTML();

    for (const label of ['이미지 왼쪽 정렬', '이미지 가운데 정렬', '이미지 오른쪽 정렬']) {
      const control = screen.getByRole('button', { name: label });

      expect(control).toBeDisabled();
      fireEvent.click(control);
    }

    expect(editor.getHTML()).toBe(before);
  });

  it('글자색 입력과 제거가 선택한 실제 텍스트의 style을 바꾼다', async () => {
    const { editor, element } = await renderToolbar('<p>색상</p>');
    selectParagraphText(editor, element);

    fireEvent.change(screen.getByLabelText('글자색'), { target: { value: '#ff0000' } });
    await waitFor(() => expect(element.innerHTML).toContain('style="color: #ff0000;"'));
    fireEvent.click(screen.getByRole('button', { name: '글자색 제거' }));
    await waitFor(() => expect(element.innerHTML).not.toContain('color:'));
  });

  it('유효한 링크를 실제 문서에 추가하고 현재 주소를 prefill한 뒤 제거한다', async () => {
    const prompt = vi.fn().mockReturnValueOnce('https://example.com/path').mockReturnValueOnce('');
    vi.stubGlobal('prompt', prompt);
    const { editor, element } = await renderToolbar('<p>링크</p>');
    selectParagraphText(editor, element);

    fireEvent.click(screen.getByRole('button', { name: '링크 설정' }));
    await waitFor(() =>
      expect(element.innerHTML).toContain('<a href="https://example.com/path">링크</a>'),
    );
    expect(screen.getByRole('button', { name: '링크 설정' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: '링크 설정' }));
    expect(prompt).toHaveBeenLastCalledWith('링크 주소', 'https://example.com/path');
    await waitFor(() => expect(element.innerHTML).not.toContain('<a '));
  });

  it('허용하지 않은 링크 입력은 문서를 바꾸지 않는다', async () => {
    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'javascript:alert(1)'),
    );
    const { editor, element } = await renderToolbar('<p>안전</p>');
    selectParagraphText(editor, element);
    const before = element.innerHTML;

    fireEvent.click(screen.getByRole('button', { name: '링크 설정' }));

    await act(async () => {});
    expect(element.innerHTML).toBe(before);
  });

  it('서식 지우기가 선택 텍스트의 mark를 모두 제거한다', async () => {
    const { editor, element } = await renderToolbar(
      '<p><strong><em><span style="color: #ff0000">지우기</span></em></strong></p>',
    );
    selectText(editor, getTextNode(element, 'em'));

    fireEvent.click(screen.getByRole('button', { name: '서식 지우기' }));

    await waitFor(() => expect(element.innerHTML).toBe('<p>지우기</p>'));
  });

  it('아이콘 전용 control이 접근 가능한 이름과 tooltip을 유지한다', async () => {
    render(<HtmlEditor value="<p>도구</p>" onChange={vi.fn()} />);
    await screen.findByRole('toolbar', { name: '서식 도구' });

    for (const [label, iconName] of Object.entries(iconOnlyControls)) {
      const control = screen.getByRole('button', { name: label });
      const icon = control.querySelector('svg');

      expect(control).toHaveAttribute('title', label);
      expect(control.textContent).toBe('');
      expect(control.querySelectorAll('svg')).toHaveLength(1);
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      expect(icon).toHaveAttribute('focusable', 'false');
      expect(icon).toHaveClass(`lucide-${iconName}`);
    }
  });

  it('텍스트가 더 명확한 control은 텍스트와 native 표현을 유지한다', async () => {
    render(<HtmlEditor value="<p>도구</p>" onChange={vi.fn()} />);
    await screen.findByRole('toolbar', { name: '서식 도구' });

    for (const label of textOnlyLabels) {
      const control = screen.getByRole('button', { name: label });

      expect(control).not.toHaveAttribute('title');
      expect(control.textContent).toBe(label);
      expect(control.querySelector('svg')).toBeNull();
    }

    const color = screen.getByLabelText('글자색');
    expect(color.tagName).toBe('INPUT');
    expect(color).toHaveAttribute('type', 'color');
    expect(color.querySelector('svg')).toBeNull();
  });

  it('아이콘 전환 후에도 toolbar가 아이콘과 텍스트 control만 노출한다', async () => {
    render(<HtmlEditor value="<p>도구</p>" onChange={vi.fn()} />);
    const toolbar = await screen.findByRole('toolbar', { name: '서식 도구' });
    const labels = Array.from(toolbar.querySelectorAll('button')).map((button) =>
      button.getAttribute('aria-label'),
    );

    expect(labels).toEqual([...defaultToolbarLabels]);
  });
});
