import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HtmlEditor, type HtmlEditorHandle } from '../src';

afterEach(() => {
  vi.unstubAllGlobals();
});

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

function rect(width: number): DOMRect {
  return {
    bottom: 100,
    height: 100,
    left: 0,
    right: width,
    top: 0,
    width,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  };
}

function loadImageForResize(editor: HTMLElement, image: HTMLImageElement, width: number): void {
  vi.spyOn(editor, 'getBoundingClientRect').mockReturnValue(rect(500));
  vi.spyOn(image, 'getBoundingClientRect').mockReturnValue(rect(width));
  fireEvent.load(image);
}

function enablePointerCapture(handle: HTMLElement): {
  releasePointerCapture: ReturnType<typeof vi.fn>;
  setPointerCapture: ReturnType<typeof vi.fn>;
} {
  const setPointerCapture = vi.fn();
  const releasePointerCapture = vi.fn();
  Object.assign(handle, {
    hasPointerCapture: () => true,
    releasePointerCapture,
    setPointerCapture,
  });

  return { releasePointerCapture, setPointerCapture };
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

  it('readOnly 전환은 image가 아닌 node selection을 보존한다', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <HtmlEditor
        value={'<img src="https://cdn.example.com/selected.png" alt="교체 전 image"><p>뒤</p>'}
        onChange={onChange}
      />,
    );
    const image = await screen.findByRole('img', { name: '교체 전 image' });
    fireEvent.pointerDown(image, { button: 0, isPrimary: true, pointerId: 6 });

    rerender(<HtmlEditor value="<hr><p>뒤</p>" onChange={onChange} />);
    const horizontalRule = await waitFor(() => {
      const element = getEditor().querySelector('hr.ProseMirror-selectednode');
      return requireElement(element, '교체 후 node selection');
    });

    rerender(<HtmlEditor value="<hr><p>뒤</p>" onChange={onChange} readOnly />);

    await waitFor(() => expect(horizontalRule).toHaveClass('ProseMirror-selectednode'));
  });

  it('load된 이미지를 선택하면 handle을 표시하고 active drag 중 node 교체 시 정리한다', async () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <HtmlEditor
        value={
          '<p>앞</p><img src="https://cdn.example.com/resize.png" alt="크기 조절 대상"><p>뒤</p>'
        }
        onChange={onChange}
      />,
    );
    const editor = await screen.findByRole('textbox');
    const image = (await screen.findByRole('img', {
      name: '크기 조절 대상',
    })) as HTMLImageElement;
    loadImageForResize(editor, image, 200);

    expect(screen.queryByRole('button', { name: '이미지 크기 조절' })).not.toBeInTheDocument();

    fireEvent.pointerDown(image, { button: 0, isPrimary: true, pointerId: 7 });

    expect(screen.getByRole('button', { name: '이미지 크기 조절' })).toBeInTheDocument();
    expect(container.querySelector('.editor-simple__image--selected')).toContainElement(image);

    const handle = screen.getByRole('button', { name: '이미지 크기 조절' });
    enablePointerCapture(handle);
    const wrapper = requireElement(
      image.closest<HTMLElement>('.editor-simple__image'),
      'image NodeView wrapper',
    );
    onChange.mockClear();
    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 100,
      isPrimary: true,
      pointerId: 7,
    });
    fireEvent.pointerMove(handle, { clientX: 200, isPrimary: true, pointerId: 7 });
    expect(wrapper).toHaveStyle({ width: '300px' });

    rerender(<HtmlEditor value="<p>교체된 문서</p>" onChange={onChange} />);

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '이미지 크기 조절' })).not.toBeInTheDocument(),
    );
    expect(wrapper.style.width).toBe('fit-content');
    fireEvent.pointerUp(handle, { clientX: 200, isPrimary: true, pointerId: 7 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('load 전과 readOnly 이미지에는 resize handle을 표시하지 않는다', async () => {
    const { rerender } = render(
      <HtmlEditor
        value={'<img src="https://cdn.example.com/resize.png" alt="크기 조절 대상">'}
        onChange={vi.fn()}
      />,
    );
    const editor = await screen.findByRole('textbox');
    const image = (await screen.findByRole('img', {
      name: '크기 조절 대상',
    })) as HTMLImageElement;
    vi.spyOn(editor, 'getBoundingClientRect').mockReturnValue(rect(500));
    vi.spyOn(image, 'getBoundingClientRect').mockReturnValue(rect(200));

    fireEvent.pointerDown(image, { button: 0, isPrimary: true, pointerId: 7 });
    expect(image.closest('.editor-simple__image')).toHaveClass('editor-simple__image--selected');
    expect(screen.queryByRole('button', { name: '이미지 크기 조절' })).not.toBeInTheDocument();

    fireEvent.load(image);
    expect(screen.getByRole('button', { name: '이미지 크기 조절' })).toBeInTheDocument();

    rerender(
      <HtmlEditor
        value={'<img src="https://cdn.example.com/resize.png" alt="크기 조절 대상">'}
        onChange={vi.fn()}
        readOnly
      />,
    );

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '이미지 크기 조절' })).not.toBeInTheDocument(),
    );
  });

  it('drag 중 DOM만 preview하고 종료 시 width만 편집 영역 안에서 commit한다', async () => {
    const onChange = vi.fn();
    const source =
      '<img src="https://cdn.example.com/resize.png" alt="보존할 설명" width="200" style="margin-left: auto; margin-right: auto">';
    render(<HtmlEditor value={source} onChange={onChange} />);
    const editor = await screen.findByRole('textbox');
    const image = (await screen.findByRole('img', { name: '보존할 설명' })) as HTMLImageElement;
    loadImageForResize(editor, image, 200);
    fireEvent.pointerDown(image, { button: 0, isPrimary: true, pointerId: 7 });
    const handle = screen.getByRole('button', { name: '이미지 크기 조절' });
    const { setPointerCapture } = enablePointerCapture(handle);
    const wrapper = requireElement(
      image.closest('.editor-simple__image'),
      'image NodeView wrapper',
    );
    onChange.mockClear();

    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 100,
      isPrimary: true,
      pointerId: 7,
    });
    fireEvent.pointerMove(handle, { clientX: 900, isPrimary: true, pointerId: 7 });

    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(wrapper).toHaveStyle({ width: '500px' });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.pointerUp(handle, { clientX: 900, isPrimary: true, pointerId: 7 });

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    const savedHtml = onChange.mock.lastCall?.[0] as string;
    expect(savedHtml).toContain('width="500"');
    expect(savedHtml).toContain('src="https://cdn.example.com/resize.png"');
    expect(savedHtml).toContain('alt="보존할 설명"');
    expect(savedHtml).toContain('margin-left: auto');
    expect(savedHtml).toContain('margin-right: auto');
    expect(savedHtml).not.toContain('height="');
    expect(savedHtml).not.toContain('editor-simple__image');
  });

  it('drag를 32px로 clamp하고 undo 한 번으로 시작 width를 복원한다', async () => {
    const onChange = vi.fn();
    render(
      <HtmlEditor
        value={
          '<p>앞</p><img src="https://cdn.example.com/resize.png" alt="undo 대상" width="200"><p>뒤</p>'
        }
        onChange={onChange}
      />,
    );
    const editor = await screen.findByRole('textbox');
    const image = (await screen.findByRole('img', { name: 'undo 대상' })) as HTMLImageElement;
    loadImageForResize(editor, image, 200);
    fireEvent.pointerDown(image, { button: 0, isPrimary: true, pointerId: 11 });
    const handle = screen.getByRole('button', { name: '이미지 크기 조절' });
    enablePointerCapture(handle);
    onChange.mockClear();

    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 200,
      isPrimary: true,
      pointerId: 11,
    });
    fireEvent.pointerMove(handle, { clientX: -500, isPrimary: true, pointerId: 11 });
    fireEvent.pointerUp(handle, { clientX: -500, isPrimary: true, pointerId: 11 });

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining('width="32"')),
    );

    fireEvent.keyDown(editor, { code: 'KeyZ', ctrlKey: true, key: 'z' });

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining('width="200"')),
    );
  });

  it('시작 node width와 종료 width가 같으면 transaction과 onChange를 만들지 않는다', async () => {
    const onChange = vi.fn();
    render(
      <HtmlEditor
        value={'<img src="https://cdn.example.com/resize.png" alt="no-op 대상" width="200">'}
        onChange={onChange}
      />,
    );
    const editor = await screen.findByRole('textbox');
    const image = (await screen.findByRole('img', { name: 'no-op 대상' })) as HTMLImageElement;
    loadImageForResize(editor, image, 200);
    fireEvent.pointerDown(image, { button: 0, isPrimary: true, pointerId: 13 });
    const handle = screen.getByRole('button', { name: '이미지 크기 조절' });
    enablePointerCapture(handle);
    onChange.mockClear();

    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 100,
      isPrimary: true,
      pointerId: 13,
    });
    fireEvent.pointerUp(handle, { clientX: 100, isPrimary: true, pointerId: 13 });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '이미지 크기 조절' })).toBeInTheDocument();
  });

  it.each([
    { contentWidth: 500.75, expectedWidth: 500 },
    { contentWidth: 20_000, expectedWidth: 10_000 },
  ])(
    '편집 영역 $contentWidth px에서 schema 상한 $expectedWidth 정수 px로 commit한다',
    async ({ contentWidth, expectedWidth }) => {
      const onChange = vi.fn();
      render(
        <HtmlEditor
          value={'<img src="https://cdn.example.com/resize.png" alt="정수 clamp 대상" width="200">'}
          onChange={onChange}
        />,
      );
      const editor = await screen.findByRole('textbox');
      const image = (await screen.findByRole('img', {
        name: '정수 clamp 대상',
      })) as HTMLImageElement;
      vi.spyOn(editor, 'getBoundingClientRect').mockReturnValue(rect(contentWidth));
      vi.spyOn(image, 'getBoundingClientRect').mockReturnValue(rect(200));
      fireEvent.load(image);
      fireEvent.pointerDown(image, { button: 0, isPrimary: true, pointerId: 12 });
      const handle = screen.getByRole('button', { name: '이미지 크기 조절' });
      enablePointerCapture(handle);
      onChange.mockClear();

      fireEvent.pointerDown(handle, {
        button: 0,
        clientX: 100,
        isPrimary: true,
        pointerId: 12,
      });
      fireEvent.pointerUp(handle, {
        clientX: 30_000,
        isPrimary: true,
        pointerId: 12,
      });

      await waitFor(() =>
        expect(onChange).toHaveBeenLastCalledWith(
          expect.stringContaining(`width="${expectedWidth}"`),
        ),
      );
    },
  );

  it('편집면 border-box에서 padding과 border를 제외한 content width로 clamp한다', async () => {
    const onChange = vi.fn();
    render(
      <HtmlEditor
        value={
          '<img src="https://cdn.example.com/resize.png" alt="content width 대상" width="200">'
        }
        onChange={onChange}
      />,
    );
    const editor = await screen.findByRole('textbox');
    const image = (await screen.findByRole('img', {
      name: 'content width 대상',
    })) as HTMLImageElement;
    editor.style.paddingLeft = '10px';
    editor.style.paddingRight = '15px';
    editor.style.borderLeft = '4px solid black';
    editor.style.borderRight = '6px solid black';
    vi.spyOn(editor, 'getBoundingClientRect').mockReturnValue(rect(500));
    vi.spyOn(image, 'getBoundingClientRect').mockReturnValue(rect(200));
    fireEvent.load(image);
    fireEvent.pointerDown(image, { button: 0, isPrimary: true, pointerId: 14 });
    const handle = screen.getByRole('button', { name: '이미지 크기 조절' });
    enablePointerCapture(handle);
    onChange.mockClear();

    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 100,
      isPrimary: true,
      pointerId: 14,
    });
    fireEvent.pointerUp(handle, { clientX: 1_000, isPrimary: true, pointerId: 14 });

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining('width="465"')),
    );
  });

  it('다른 pointer와 cancel 뒤 late event를 무시하고 preview를 복원한다', async () => {
    const onChange = vi.fn();
    render(
      <HtmlEditor
        value={'<img src="https://cdn.example.com/resize.png" alt="취소 대상" width="200">'}
        onChange={onChange}
      />,
    );
    const editor = await screen.findByRole('textbox');
    const image = (await screen.findByRole('img', { name: '취소 대상' })) as HTMLImageElement;
    loadImageForResize(editor, image, 200);
    fireEvent.pointerDown(image, { button: 0, isPrimary: true, pointerId: 21 });
    const handle = screen.getByRole('button', { name: '이미지 크기 조절' });
    enablePointerCapture(handle);
    const wrapper = requireElement(
      image.closest('.editor-simple__image'),
      'image NodeView wrapper',
    );
    onChange.mockClear();

    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 100,
      isPrimary: true,
      pointerId: 21,
    });
    fireEvent.pointerMove(handle, { clientX: 200, isPrimary: true, pointerId: 21 });
    expect(wrapper).toHaveStyle({ width: '300px' });

    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 0,
      isPrimary: true,
      pointerId: 22,
    });
    fireEvent.pointerMove(handle, { clientX: 450, isPrimary: true, pointerId: 22 });
    fireEvent.pointerUp(handle, { clientX: 450, isPrimary: true, pointerId: 22 });
    expect(wrapper).toHaveStyle({ width: '300px' });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.pointerCancel(handle, { pointerId: 21 });
    expect(wrapper).toHaveStyle({ width: '200px' });

    fireEvent.pointerMove(handle, { clientX: 400, isPrimary: true, pointerId: 21 });
    fireEvent.pointerUp(handle, { clientX: 400, isPrimary: true, pointerId: 21 });
    expect(wrapper).toHaveStyle({ width: '200px' });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 100,
      isPrimary: true,
      pointerId: 23,
    });
    fireEvent.pointerMove(handle, { clientX: 250, isPrimary: true, pointerId: 23 });
    expect(wrapper).toHaveStyle({ width: '350px' });

    fireEvent(handle, new PointerEvent('lostpointercapture', { pointerId: 23 }));

    expect(wrapper).toHaveStyle({ width: '200px' });
    fireEvent.pointerUp(handle, { clientX: 250, isPrimary: true, pointerId: 23 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('drag 중 편집 영역이 32px 미만으로 줄면 ResizeObserver가 취소한다', async () => {
    let resizeCallback: ResizeObserverCallback | undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resizeCallback = callback;
        }

        disconnect(): void {}
        observe(): void {}
        unobserve(): void {}
      },
    );
    const onChange = vi.fn();
    render(
      <HtmlEditor
        value={'<img src="https://cdn.example.com/resize.png" alt="영역 축소 대상" width="200">'}
        onChange={onChange}
      />,
    );
    const editor = await screen.findByRole('textbox');
    const image = (await screen.findByRole('img', {
      name: '영역 축소 대상',
    })) as HTMLImageElement;
    let editorWidth = 500;
    vi.spyOn(editor, 'getBoundingClientRect').mockImplementation(() => rect(editorWidth));
    vi.spyOn(image, 'getBoundingClientRect').mockReturnValue(rect(200));
    fireEvent.load(image);
    fireEvent.pointerDown(image, { button: 0, isPrimary: true, pointerId: 24 });
    const handle = screen.getByRole('button', { name: '이미지 크기 조절' });
    enablePointerCapture(handle);
    const wrapper = requireElement(
      image.closest('.editor-simple__image'),
      'image NodeView wrapper',
    );
    onChange.mockClear();

    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 100,
      isPrimary: true,
      pointerId: 24,
    });
    fireEvent.pointerMove(handle, { clientX: 200, isPrimary: true, pointerId: 24 });
    expect(wrapper).toHaveStyle({ width: '300px' });

    editorWidth = 20;
    act(() => resizeCallback?.([], {} as ResizeObserver));

    expect(wrapper).toHaveStyle({ width: '200px' });
    expect(screen.queryByRole('button', { name: '이미지 크기 조절' })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('drag 중 readOnly 전환과 unmount는 commit 없이 session을 정리한다', async () => {
    const onChange = vi.fn();
    const value =
      '<p>앞</p><img src="https://cdn.example.com/resize.png" alt="cleanup 대상" width="200"><p>뒤</p>';
    const { rerender, unmount } = render(<HtmlEditor value={value} onChange={onChange} />);
    const editor = await screen.findByRole('textbox');
    const image = (await screen.findByRole('img', { name: 'cleanup 대상' })) as HTMLImageElement;
    loadImageForResize(editor, image, 200);
    fireEvent.pointerDown(image, { button: 0, isPrimary: true, pointerId: 31 });
    const handle = screen.getByRole('button', { name: '이미지 크기 조절' });
    enablePointerCapture(handle);
    const wrapper = requireElement(
      image.closest('.editor-simple__image'),
      'image NodeView wrapper',
    );
    onChange.mockClear();

    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 100,
      isPrimary: true,
      pointerId: 31,
    });
    fireEvent.pointerMove(handle, { clientX: 250, isPrimary: true, pointerId: 31 });
    expect(wrapper).toHaveStyle({ width: '350px' });

    rerender(<HtmlEditor value={value} onChange={onChange} readOnly />);

    await waitFor(() => expect(wrapper).toHaveStyle({ width: '200px' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '이미지 크기 조절' })).not.toBeInTheDocument();

    rerender(<HtmlEditor value={value} onChange={onChange} />);
    const nextImage = (await screen.findByRole('img', {
      name: 'cleanup 대상',
    })) as HTMLImageElement;
    loadImageForResize(editor, nextImage, 200);
    fireEvent.pointerDown(nextImage, { button: 0, isPrimary: true, pointerId: 32 });
    const nextHandle = await screen.findByRole('button', { name: '이미지 크기 조절' });
    const nextWrapper = requireElement(
      nextHandle.closest<HTMLElement>('.editor-simple__image'),
      '다시 선택한 image NodeView wrapper',
    );
    enablePointerCapture(nextHandle);
    fireEvent.pointerDown(nextHandle, {
      button: 0,
      clientX: 100,
      isPrimary: true,
      pointerId: 32,
    });
    fireEvent.pointerMove(nextHandle, { clientX: 300, isPrimary: true, pointerId: 32 });

    unmount();
    fireEvent.pointerUp(nextHandle, { clientX: 300, isPrimary: true, pointerId: 32 });

    expect(nextWrapper.style.width).toBe('200px');
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
