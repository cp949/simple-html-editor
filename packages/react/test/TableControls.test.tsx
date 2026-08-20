import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createHtmlEditorExtensions } from '@cp949/editor-simple-core';
import type { Editor } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { HtmlEditor } from '../src';
import { Toolbar } from '../src/Toolbar';

type ToolbarHarnessProps = {
  value: string;
  readOnly?: boolean;
  onEditor: (editor: Editor) => void;
};

/** Table control이 실제 Tiptap 문서와 selection을 함께 다루도록 렌더링한다. */
function ToolbarHarness({ value, readOnly = false, onEditor }: ToolbarHarnessProps) {
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

/** 지정한 표 cell 안으로 실제 ProseMirror selection을 이동한다. */
function selectTableCell(editor: Editor, text: string): void {
  let textPosition: number | undefined;

  editor.state.doc.descendants((node, position) => {
    if (node.isText && node.text === text && textPosition === undefined) {
      textPosition = position;
    }
  });

  if (textPosition === undefined) {
    throw new Error(`표 cell 텍스트를 찾을 수 없습니다: ${text}`);
  }
  const resolvedTextPosition = textPosition;

  act(() => {
    editor.commands.focus();
    editor.commands.setTextSelection(resolvedTextPosition);
  });
}

function tableMatrix(element: HTMLElement): string[][] {
  return Array.from(element.querySelectorAll('table tr')).map((row) =>
    Array.from(row.children).map((cell) => cell.textContent ?? ''),
  );
}

function firstTableRowTags(element: HTMLElement): string[] {
  const firstRow = element.querySelector('table tr');

  if (!firstRow) {
    throw new Error('표의 첫 행을 찾을 수 없습니다.');
  }

  return Array.from(firstRow.children).map((cell) => cell.tagName.toLowerCase());
}

const tableHtml = `
  <table>
    <tr><th><p>헤더 왼쪽</p></th><th><p>선택 헤더</p></th><th><p>헤더 오른쪽</p></th></tr>
    <tr><td><p>첫 행 왼쪽</p></td><td><p>첫 행 가운데</p></td><td><p>첫 행 오른쪽</p></td></tr>
    <tr><td><p>선택 행 왼쪽</p></td><td><p>선택 행 가운데</p></td><td><p>선택 행 오른쪽</p></td></tr>
    <tr><td><p>마지막 행 왼쪽</p></td><td><p>마지막 행 가운데</p></td><td><p>마지막 행 오른쪽</p></td></tr>
  </table>
`;

describe('TableControls', () => {
  it('3x3 표를 header 행과 함께 실제 문서에 삽입한다', async () => {
    const { element } = await renderToolbar('<p>표 앞</p>');

    fireEvent.click(screen.getByRole('button', { name: '표 삽입' }));

    await waitFor(() => expect(element.querySelectorAll('table tr')).toHaveLength(3));
    expect(element.querySelectorAll('table tr:first-child th')).toHaveLength(3);
    expect(element.querySelectorAll('table td')).toHaveLength(6);
    expect(screen.getByRole('button', { name: '위에 행 추가' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '왼쪽에 열 추가' })).toBeEnabled();
  });

  it('표 밖 selection에서는 contextual row, column, table control을 노출하지 않는다', async () => {
    await renderToolbar('<p>표 밖</p>');

    for (const label of [
      '위에 행 추가',
      '아래에 행 추가',
      '행 삭제',
      '왼쪽에 열 추가',
      '오른쪽에 열 추가',
      '열 삭제',
      '표 삭제',
    ]) {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    }
    for (const label of ['셀 병합', '셀 분할', '표 크기 조절']) {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    }
  });

  it('표 안 selection에서는 표 삽입 control을 노출하지 않는다', async () => {
    const { editor, element } = await renderToolbar(tableHtml);
    selectTableCell(editor, '선택 행 가운데');

    await waitFor(() => expect(element.querySelector('table')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: '표 삽입' })).not.toBeInTheDocument();
  });

  it('현재 행의 앞뒤에 빈 행을 올바른 위치에 추가하고 선택 행을 삭제한다', async () => {
    const { editor, element } = await renderToolbar(tableHtml);
    selectTableCell(editor, '선택 행 가운데');

    await waitFor(() => expect(screen.getByRole('button', { name: '위에 행 추가' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '위에 행 추가' }));
    await waitFor(() =>
      expect(tableMatrix(element)).toEqual([
        ['헤더 왼쪽', '선택 헤더', '헤더 오른쪽'],
        ['첫 행 왼쪽', '첫 행 가운데', '첫 행 오른쪽'],
        ['', '', ''],
        ['선택 행 왼쪽', '선택 행 가운데', '선택 행 오른쪽'],
        ['마지막 행 왼쪽', '마지막 행 가운데', '마지막 행 오른쪽'],
      ]),
    );

    fireEvent.click(screen.getByRole('button', { name: '아래에 행 추가' }));
    await waitFor(() =>
      expect(tableMatrix(element)).toEqual([
        ['헤더 왼쪽', '선택 헤더', '헤더 오른쪽'],
        ['첫 행 왼쪽', '첫 행 가운데', '첫 행 오른쪽'],
        ['', '', ''],
        ['선택 행 왼쪽', '선택 행 가운데', '선택 행 오른쪽'],
        ['', '', ''],
        ['마지막 행 왼쪽', '마지막 행 가운데', '마지막 행 오른쪽'],
      ]),
    );

    fireEvent.click(screen.getByRole('button', { name: '행 삭제' }));
    await waitFor(() =>
      expect(tableMatrix(element)).toEqual([
        ['헤더 왼쪽', '선택 헤더', '헤더 오른쪽'],
        ['첫 행 왼쪽', '첫 행 가운데', '첫 행 오른쪽'],
        ['', '', ''],
        ['', '', ''],
        ['마지막 행 왼쪽', '마지막 행 가운데', '마지막 행 오른쪽'],
      ]),
    );
  });

  it('현재 열의 앞뒤에 빈 열을 올바른 위치에 추가하고 선택 열을 삭제한다', async () => {
    const { editor, element } = await renderToolbar(tableHtml);
    selectTableCell(editor, '선택 행 가운데');

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '왼쪽에 열 추가' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: '왼쪽에 열 추가' }));
    await waitFor(() =>
      expect(tableMatrix(element)[0]).toEqual(['헤더 왼쪽', '', '선택 헤더', '헤더 오른쪽']),
    );
    expect(tableMatrix(element)[2]).toEqual([
      '선택 행 왼쪽',
      '',
      '선택 행 가운데',
      '선택 행 오른쪽',
    ]);
    expect(firstTableRowTags(element)).toEqual(['th', 'th', 'th', 'th']);

    fireEvent.click(screen.getByRole('button', { name: '오른쪽에 열 추가' }));
    await waitFor(() =>
      expect(tableMatrix(element)[0]).toEqual(['헤더 왼쪽', '', '선택 헤더', '', '헤더 오른쪽']),
    );
    expect(tableMatrix(element)[2]).toEqual([
      '선택 행 왼쪽',
      '',
      '선택 행 가운데',
      '',
      '선택 행 오른쪽',
    ]);
    expect(firstTableRowTags(element)).toEqual(['th', 'th', 'th', 'th', 'th']);

    fireEvent.click(screen.getByRole('button', { name: '열 삭제' }));
    await waitFor(() =>
      expect(tableMatrix(element)[0]).toEqual(['헤더 왼쪽', '', '', '헤더 오른쪽']),
    );
    expect(tableMatrix(element)[2]).toEqual(['선택 행 왼쪽', '', '', '선택 행 오른쪽']);
    expect(firstTableRowTags(element)).toEqual(['th', 'th', 'th', 'th']);
  });

  it('현재 표를 문서에서 삭제한다', async () => {
    const { editor, element } = await renderToolbar(tableHtml);
    selectTableCell(editor, '선택 행 가운데');

    await waitFor(() => expect(screen.getByRole('button', { name: '표 삭제' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '표 삭제' }));

    await waitFor(() => expect(element.querySelector('table')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: '위에 행 추가' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '표 삭제' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '표 삽입' })).toBeEnabled();
  });

  it('마지막 한 행과 한 열일 때는 삭제 control을 비활성화한다', async () => {
    const { editor } = await renderToolbar('<table><tr><td><p>유일한 내용</p></td></tr></table>');
    selectTableCell(editor, '유일한 내용');

    await waitFor(() => expect(screen.getByRole('button', { name: '행 삭제' })).toBeDisabled());
    expect(screen.getByRole('button', { name: '열 삭제' })).toBeDisabled();
  });

  it('readOnly에서는 contextual 표 변경을 막는다', async () => {
    const onChange = vi.fn();
    render(<HtmlEditor value={tableHtml} onChange={onChange} readOnly />);
    const element = await screen.findByRole('textbox');
    const before = element.innerHTML;

    expect(screen.queryByRole('button', { name: '표 삽입' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '표 삭제' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '표 삭제' }));

    expect(element.innerHTML).toBe(before);
    expect(onChange).not.toHaveBeenCalled();
  });
});
