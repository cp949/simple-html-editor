import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HtmlEditor } from '../src';

const imageTypes = [
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/gif', 'gif'],
  ['image/webp', 'webp'],
] as const;

type ClipboardDataItem = Pick<DataTransferItem, 'getAsFile' | 'kind' | 'type'>;

/** Toolbar가 만든 파일 선택 input을 반환한다. */
function getFileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');

  if (!(input instanceof HTMLInputElement)) {
    throw new Error('파일 선택 input을 찾을 수 없습니다.');
  }

  return input;
}

/** 실제 브라우저 이벤트처럼 clipboardData를 붙인 paste event를 만든다. */
function createPasteEvent(items: ClipboardDataItem[]): Event {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: {
      files: [],
      getData: () => '',
      items,
      types: [],
    },
  });

  return event;
}

/** FileReader 성공 결과를 제어하기 위한 최소 브라우저 I/O 대역이다. */
function stubSuccessfulFileReader(): void {
  class SuccessfulFileReader {
    result: string | ArrayBuffer | null = null;
    onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
    onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;

    readAsDataURL(file: File): void {
      this.result = `data:${file.type};base64,ZmFrZQ==`;
      this.onload?.(new ProgressEvent('load') as ProgressEvent<FileReader>);
    }
  }

  vi.stubGlobal('FileReader', SuccessfulFileReader);
}

/** FileReader 읽기 실패를 재현하기 위한 최소 브라우저 I/O 대역이다. */
function stubFailingFileReader(): void {
  class FailingFileReader {
    result: string | ArrayBuffer | null = null;
    onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
    onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;

    readAsDataURL(): void {
      this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>);
    }
  }

  vi.stubGlobal('FileReader', FailingFileReader);
}

/** 완료 시점을 호출자가 정하는 FileReader로 비동기 read 경계를 재현한다. */
function stubDelayedFileReader(): { complete(): void; fail(): void } {
  const readers: DelayedFileReader[] = [];

  class DelayedFileReader {
    file: File | undefined;
    result: string | ArrayBuffer | null = null;
    onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
    onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;

    readAsDataURL(file: File): void {
      this.file = file;
      readers.push(this);
    }
  }

  vi.stubGlobal('FileReader', DelayedFileReader);

  return {
    complete() {
      for (const reader of readers) {
        if (!reader.file) {
          throw new Error('FileReader에 읽을 파일이 없습니다.');
        }
        reader.result = `data:${reader.file.type};base64,ZmFrZQ==`;
        reader.onload?.(new ProgressEvent('load') as ProgressEvent<FileReader>);
      }
    },
    fail() {
      for (const reader of readers) {
        reader.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>);
      }
    },
  };
}

/** file input의 실제 change 경로로 파일을 선택한다. */
function selectFile(file: File): void {
  selectFileFromInput(getFileInput(), file);
}

/** 기존 input에 늦게 도착한 change event를 재현한다. */
function selectFileFromInput(input: HTMLInputElement, file: File): void {
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: { 0: file, item: (index: number) => (index === 0 ? file : null), length: 1 },
  });
  fireEvent.change(input);
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.querySelectorAll('input[type="file"]').forEach((input) => {
    input.remove();
  });
});

describe('HtmlEditor image insertion', () => {
  it.each(imageTypes)(
    '%s 파일을 data URL 이미지로 넣고 파일명을 alt로 보존한다',
    async (type, extension) => {
      stubSuccessfulFileReader();
      const onChange = vi.fn();
      render(<HtmlEditor value="<p>이미지 앞</p>" onChange={onChange} />);
      const editor = await screen.findByRole('textbox');

      fireEvent.click(screen.getByRole('button', { name: '이미지 추가' }));
      selectFile(new File(['image'], `대표.${extension}`, { type }));

      await waitFor(() => {
        expect(editor.innerHTML).toContain(`src="data:${type};base64,ZmFrZQ=="`);
        expect(editor.innerHTML).toContain(`alt="대표.${extension}"`);
      });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.stringContaining(`data:${type};base64,ZmFrZQ==`),
      );
      expect(document.querySelector('input[type="file"]')).toBeNull();
    },
  );

  it('SVG 선택을 거절하고 문서를 바꾸지 않은 채 오류를 알린다', async () => {
    const onChange = vi.fn();
    render(<HtmlEditor value="<p>안전한 문서</p>" onChange={onChange} />);
    const editor = await screen.findByRole('textbox');
    const before = editor.innerHTML;

    fireEvent.click(screen.getByRole('button', { name: '이미지 추가' }));
    selectFile(new File(['<svg />'], '위험.svg', { type: 'image/svg+xml' }));

    expect(await screen.findByRole('status')).toHaveTextContent('지원하지 않는 이미지 형식입니다.');
    expect(editor.innerHTML).toBe(before);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('FileReader 실패를 문서 변경 없이 오류로 알린다', async () => {
    stubFailingFileReader();
    const onChange = vi.fn();
    render(<HtmlEditor value="<p>읽기 실패 전</p>" onChange={onChange} />);
    const editor = await screen.findByRole('textbox');
    const before = editor.innerHTML;

    fireEvent.click(screen.getByRole('button', { name: '이미지 추가' }));
    selectFile(new File(['image'], '실패.png', { type: 'image/png' }));

    expect(await screen.findByRole('status')).toHaveTextContent('이미지를 읽지 못했습니다.');
    expect(editor.innerHTML).toBe(before);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('파일 선택 취소 시 숨은 input을 제거하고 문서를 바꾸지 않는다', async () => {
    const onChange = vi.fn();
    render(<HtmlEditor value="<p>취소 전</p>" onChange={onChange} />);
    const editor = await screen.findByRole('textbox');
    const before = editor.innerHTML;

    fireEvent.click(screen.getByRole('button', { name: '이미지 추가' }));
    fireEvent(getFileInput(), new Event('cancel'));

    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(editor.innerHTML).toBe(before);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('지원 이미지 clipboard 항목만 가로채 data URL 이미지로 넣는다', async () => {
    stubSuccessfulFileReader();
    const onChange = vi.fn();
    render(<HtmlEditor value="<p>붙여넣기 앞</p>" onChange={onChange} />);
    const editor = await screen.findByRole('textbox');
    const event = createPasteEvent([
      {
        kind: 'file',
        type: 'image/png',
        getAsFile: () => new File(['image'], '붙여넣기.png', { type: 'image/png' }),
      },
    ]);

    act(() => {
      editor.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(editor.innerHTML).toContain('src="data:image/png;base64,ZmFrZQ=="');
      expect(editor.innerHTML).toContain('alt="붙여넣기.png"');
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('data:image/png;base64,ZmFrZQ=='),
    );
  });

  it('지원하지 않는 clipboard는 기본 paste 경로로 넘기고 문서를 바꾸지 않는다', async () => {
    const onChange = vi.fn();
    render(<HtmlEditor value="<p>기본 paste</p>" onChange={onChange} />);
    const editor = await screen.findByRole('textbox');
    const before = editor.innerHTML;
    const event = createPasteEvent([
      { kind: 'string', type: 'text/plain', getAsFile: () => null },
      {
        kind: 'file',
        type: 'image/svg+xml',
        getAsFile: () => new File(['<svg />'], '위험.svg', { type: 'image/svg+xml' }),
      },
    ]);

    act(() => {
      editor.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
    expect(editor.innerHTML).toBe(before);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('readOnly이면 이미지 선택과 지원 이미지 붙여넣기를 모두 막는다', async () => {
    stubSuccessfulFileReader();
    const onChange = vi.fn();
    render(<HtmlEditor value="<p>읽기 전용</p>" onChange={onChange} readOnly />);
    const editor = await screen.findByRole('textbox');
    const before = editor.innerHTML;
    const event = createPasteEvent([
      {
        kind: 'file',
        type: 'image/png',
        getAsFile: () => new File(['image'], '차단.png', { type: 'image/png' }),
      },
    ]);

    const button = screen.getByRole('button', { name: '이미지 추가' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    act(() => {
      editor.dispatchEvent(event);
    });

    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(event.defaultPrevented).toBe(false);
    expect(editor.innerHTML).toBe(before);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('대기 중인 파일 읽기 뒤 readOnly가 되면 이미지와 오류를 남기지 않는다', async () => {
    const reader = stubDelayedFileReader();
    const onChange = vi.fn();
    const { rerender } = render(<HtmlEditor value="<p>전환 전</p>" onChange={onChange} />);
    const editor = await screen.findByRole('textbox');
    const before = editor.innerHTML;

    fireEvent.click(screen.getByRole('button', { name: '이미지 추가' }));
    selectFile(new File(['image'], '대기.png', { type: 'image/png' }));
    rerender(<HtmlEditor value="<p>전환 전</p>" onChange={onChange} readOnly />);

    act(() => {
      reader.complete();
    });
    await act(async () => {});

    expect(editor.innerHTML).toBe(before);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('대기 중인 파일 읽기 실패 뒤 readOnly가 되면 오류 상태를 남기지 않는다', async () => {
    const reader = stubDelayedFileReader();
    const onChange = vi.fn();
    const { rerender } = render(<HtmlEditor value="<p>전환 전</p>" onChange={onChange} />);
    const editor = await screen.findByRole('textbox');
    const before = editor.innerHTML;

    fireEvent.click(screen.getByRole('button', { name: '이미지 추가' }));
    selectFile(new File(['image'], '실패.png', { type: 'image/png' }));
    rerender(<HtmlEditor value="<p>전환 전</p>" onChange={onChange} readOnly />);

    act(() => {
      reader.fail();
    });
    await act(async () => {});

    expect(editor.innerHTML).toBe(before);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('대기 중인 파일 읽기 뒤 unmount되면 문서나 상태를 갱신하지 않는다', async () => {
    const reader = stubDelayedFileReader();
    const onChange = vi.fn();
    const { unmount } = render(<HtmlEditor value="<p>제거 전</p>" onChange={onChange} />);
    const editor = await screen.findByRole('textbox');
    const before = editor.innerHTML;

    fireEvent.click(screen.getByRole('button', { name: '이미지 추가' }));
    selectFile(new File(['image'], '제거.png', { type: 'image/png' }));
    unmount();

    act(() => {
      reader.complete();
    });
    await act(async () => {});

    expect(editor.innerHTML).toBe(before);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('picker를 다시 열면 하나만 남고 제거된 input의 늦은 change는 문서를 바꾸지 않는다', async () => {
    stubSuccessfulFileReader();
    const onChange = vi.fn();
    render(<HtmlEditor value="<p>선택 전</p>" onChange={onChange} />);
    const editor = await screen.findByRole('textbox');
    const before = editor.innerHTML;

    fireEvent.click(screen.getByRole('button', { name: '이미지 추가' }));
    const replacedInput = getFileInput();
    fireEvent.click(screen.getByRole('button', { name: '이미지 추가' }));

    expect(document.querySelectorAll('input[type="file"]')).toHaveLength(1);
    expect(replacedInput.isConnected).toBe(false);
    selectFileFromInput(replacedInput, new File(['image'], '늦음.png', { type: 'image/png' }));
    await act(async () => {});

    expect(editor.innerHTML).toBe(before);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('unmount가 active picker를 제거하고 늦은 change를 무해하게 만든다', async () => {
    stubSuccessfulFileReader();
    const onChange = vi.fn();
    const { unmount } = render(<HtmlEditor value="<p>제거 전</p>" onChange={onChange} />);
    const editor = await screen.findByRole('textbox');
    const before = editor.innerHTML;

    fireEvent.click(screen.getByRole('button', { name: '이미지 추가' }));
    const removedInput = getFileInput();
    unmount();
    selectFileFromInput(removedInput, new File(['image'], '늦음.png', { type: 'image/png' }));
    await act(async () => {});

    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(editor.innerHTML).toBe(before);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
