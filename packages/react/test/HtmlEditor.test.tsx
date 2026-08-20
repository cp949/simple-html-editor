import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { HtmlEditor, type HtmlEditorHandle } from '../src';

/** 현재 렌더링된 실제 편집 영역을 반환한다. */
function getEditor(): HTMLElement {
  return screen.getByRole('textbox');
}

function requireElement<T extends Element>(element: T | null, description: string): T {
  if (!element) {
    throw new Error(`${description}을(를) 찾을 수 없습니다.`);
  }

  return element;
}

/** contenteditable의 caret을 지정한 텍스트 위치로 옮긴다. */
function setCaret(textNode: Text, offset: number): void {
  const range = document.createRange();
  range.setStart(textNode, offset);
  range.collapse(true);

  const selection = window.getSelection();
  if (!selection) {
    throw new Error('브라우저 selection을 만들 수 없습니다.');
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

describe('HtmlEditor', () => {
  it('초기 value를 편집 가능한 HTML로 표시한다', async () => {
    render(<HtmlEditor value="<p>초기 내용</p>" onChange={vi.fn()} />);

    expect(await screen.findByText('초기 내용')).toBeInTheDocument();
    expect(getEditor()).toHaveAttribute('contenteditable', 'true');
  });

  it('다중 문단 편집면의 ARIA 의미를 제공한다', async () => {
    render(<HtmlEditor value="<p>첫 문단</p><p>둘째 문단</p>" onChange={vi.fn()} />);

    const editor = await screen.findByRole('textbox', { name: 'HTML 편집 내용' });
    expect(editor).toHaveAttribute('aria-multiline', 'true');
    expect(editor).toHaveAttribute('aria-readonly', 'false');
  });

  it('안정적인 스타일 hook과 소비자 root className을 함께 렌더링한다', async () => {
    const { container } = render(
      <HtmlEditor value="<p>스타일 대상</p>" onChange={vi.fn()} className="소비자-스타일" />,
    );

    await screen.findByText('스타일 대상');

    expect(container.querySelector('.editor-simple.소비자-스타일')).toBeInTheDocument();
    expect(container.querySelector('.editor-simple__toolbar')).toHaveAttribute('role', 'toolbar');
    expect(
      container.querySelector('.editor-simple__content [contenteditable="true"]'),
    ).toBeInTheDocument();
  });

  it('사용자 편집을 정규화된 HTML로 알린다', async () => {
    const onChange = vi.fn();
    render(<HtmlEditor value="<p>초기</p>" onChange={onChange} />);
    const editor = await screen.findByRole('textbox');

    act(() => {
      requireElement(editor.querySelector('p'), '편집기 문단').textContent = '수정';
      fireEvent.input(editor, { inputType: 'insertText', data: '정' });
    });

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('<p>수정</p>'));
  });

  it('내용을 모두 지우면 undefined를 알린다', async () => {
    const onChange = vi.fn();
    render(<HtmlEditor value="<p>삭제할 내용</p>" onChange={onChange} />);
    const editor = await screen.findByRole('textbox');

    act(() => {
      requireElement(editor.querySelector('p'), '편집기 문단').textContent = '';
      fireEvent.input(editor, { inputType: 'deleteContentBackward' });
    });

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(undefined));
  });

  it('readOnly이면 편집을 허용하지 않는다', async () => {
    render(<HtmlEditor value="<p>읽기 전용</p>" onChange={vi.fn()} readOnly />);

    const editor = await screen.findByRole('textbox');
    expect(editor).toHaveAttribute('contenteditable', 'false');
    expect(editor).toHaveAttribute('aria-readonly', 'true');
  });

  it('readOnly가 false에서 true로 바뀌면 편집을 막는다', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <HtmlEditor value="<p>전환할 내용</p>" onChange={onChange} readOnly={false} />,
    );
    const editor = await screen.findByRole('textbox');
    expect(editor).toHaveAttribute('contenteditable', 'true');
    onChange.mockClear();

    rerender(<HtmlEditor value="<p>전환할 내용</p>" onChange={onChange} readOnly />);

    await waitFor(() => expect(editor).toHaveAttribute('contenteditable', 'false'));
    expect(editor).toHaveAttribute('aria-readonly', 'true');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('readOnly가 true에서 false로 바뀌면 편집을 허용한다', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <HtmlEditor value="<p>전환할 내용</p>" onChange={onChange} readOnly />,
    );
    const editor = await screen.findByRole('textbox');
    expect(editor).toHaveAttribute('contenteditable', 'false');
    onChange.mockClear();

    rerender(<HtmlEditor value="<p>전환할 내용</p>" onChange={onChange} readOnly={false} />);

    await waitFor(() => expect(editor).toHaveAttribute('contenteditable', 'true'));
    expect(editor).toHaveAttribute('aria-readonly', 'false');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('빈 문서에 placeholder를 표시한다', async () => {
    render(<HtmlEditor onChange={vi.fn()} placeholder="내용을 입력하세요" />);

    const paragraph = (await screen.findByRole('textbox')).querySelector('p');
    expect(paragraph).toHaveAttribute('data-placeholder', '내용을 입력하세요');
  });

  it('포커스를 잃으면 onBlur를 호출한다', async () => {
    const onBlur = vi.fn();
    render(<HtmlEditor onChange={vi.fn()} onBlur={onBlur} />);
    const editor = await screen.findByRole('textbox');

    fireEvent.focus(editor);
    fireEvent.blur(editor);

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('ref의 focus로 편집기에 포커스를 이동한다', async () => {
    const ref = createRef<HtmlEditorHandle>();
    render(<HtmlEditor ref={ref} onChange={vi.fn()} />);
    const editor = await screen.findByRole('textbox');

    act(() => ref.current?.focus());

    await waitFor(() => expect(editor).toHaveFocus());
  });

  it('외부 value가 A에서 B로 바뀌면 onChange 없이 B를 표시한다', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<HtmlEditor value="<p>A</p>" onChange={onChange} />);
    expect(await screen.findByText('A')).toBeInTheDocument();
    onChange.mockClear();

    rerender(<HtmlEditor value="<p>B</p>" onChange={onChange} />);

    expect(await screen.findByText('B')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('로컬 정규화 값을 부모가 반영해도 selection과 undo 기록을 유지한다', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<HtmlEditor value="<p>A</p>" onChange={onChange} />);
    const editor = await screen.findByRole('textbox');
    const paragraph = requireElement(editor.querySelector('p'), '편집기 문단');

    act(() => {
      editor.focus();
      paragraph.textContent = 'AB';
      setCaret(paragraph.firstChild as Text, 2);
      fireEvent.input(editor, { inputType: 'insertText', data: 'B' });
    });
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('<p>AB</p>'));

    act(() => setCaret(paragraph.firstChild as Text, 1));
    rerender(<HtmlEditor value="<p>AB</p>" onChange={onChange} />);

    expect(window.getSelection()?.anchorOffset).toBe(1);
    fireEvent.keyDown(editor, { key: 'z', code: 'KeyZ', ctrlKey: true });
    await waitFor(() => expect(editor).toHaveTextContent('A'));
  });

  it('외부 value가 그대로인 unrelated rerender는 로컬 편집 내용을 되돌리지 않는다', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<HtmlEditor value="<p>A</p>" onChange={onChange} />);
    const editor = await screen.findByRole('textbox');

    act(() => {
      requireElement(editor.querySelector('p'), '편집기 문단').textContent = 'AB';
      fireEvent.input(editor, { inputType: 'insertText', data: 'B' });
    });
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('<p>AB</p>'));

    rerender(<HtmlEditor value="<p>A</p>" onChange={onChange} className="부모만-다시-렌더링" />);

    expect(editor).toHaveTextContent('AB');
  });
});
