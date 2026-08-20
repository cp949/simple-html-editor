import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { introHtml, unsafeHtml } from './fixtures';

/** 화면에 표시한 서버 저장 HTML을 반환한다. */
function getServerSnapshot(): HTMLElement {
  return screen.getByLabelText('서버 저장 HTML');
}

function requireElement<T extends Element>(element: T | null, description: string): T {
  if (!element) {
    throw new Error(`${description}을(를) 찾을 수 없습니다.`);
  }

  return element;
}

describe('demo App', () => {
  beforeEach(() => {
    vi.stubGlobal('alert', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('consumer fixture와 HTML 편집 안내를 공개 편집기에 표시한다', async () => {
    render(<App />);

    expect(await screen.findByText('음성인식(STT)은')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '이미지 fixture 불러오기' }));
    expect(screen.getByText('data URL 이미지')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '서버에서 불러오기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '서버에 저장' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '저장값 다시 불러오기' })).toBeInTheDocument();
  });

  it('저장값 다시 불러오기는 현재 편집값 대신 서버에 저장한 HTML을 사용한다', async () => {
    render(<App />);
    const editor = await screen.findByRole('textbox');

    act(() => {
      requireElement(editor.querySelector('p'), '편집기 문단').textContent = '서버에 저장할 현재값';
      fireEvent.input(editor, { inputType: 'insertText', data: '값' });
    });
    await waitFor(() => expect(editor).toHaveTextContent('서버에 저장할 현재값'));
    await waitFor(() =>
      expect(screen.getByText('현재 편집값: 서버 저장값과 다릅니다.')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: '서버에 저장' }));
    await waitFor(() =>
      expect(screen.getByText('현재 편집값: 서버 저장값과 같습니다.')).toBeInTheDocument(),
    );

    act(() => {
      requireElement(editor.querySelector('p'), '편집기 문단').textContent = '저장 뒤의 현재값';
      fireEvent.input(editor, { inputType: 'insertText', data: '값' });
    });
    await waitFor(() => expect(editor).toHaveTextContent('저장 뒤의 현재값'));
    await waitFor(() =>
      expect(screen.getByText('현재 편집값: 서버 저장값과 다릅니다.')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: '저장값 다시 불러오기' }));

    await waitFor(() => expect(editor).toHaveTextContent('서버에 저장할 현재값'));
    expect(editor).not.toHaveTextContent('저장 뒤의 현재값');
  });

  it('raw intro fixture는 안전 본문을 표시하고 첫 편집 전에는 저장을 막는다', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'intro fixture 불러오기' }));
    const editor = await screen.findByRole('textbox');

    expect(introHtml).toContain('<script');
    expect(introHtml).toContain('onclick');
    expect(introHtml).toContain('background-image');
    expect(editor.querySelector('strong')).toHaveTextContent('음성을');
    expect(editor.querySelector('span')).toHaveStyle({ color: '#0047b2' });
    expect(editor.innerHTML).not.toContain('<script');
    expect(editor.innerHTML).not.toContain('onclick');
    expect(editor.innerHTML).not.toContain('background-image');
    expect(screen.getByRole('button', { name: '서버에 저장' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('직접 편집한 뒤 저장할 수 있습니다.');
  });

  it('raw unsafe fixture는 편집 뒤 정규화한 모델 HTML만 서버 snapshot에 저장한다', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'unsafe fixture 불러오기' }));
    const editor = await screen.findByRole('textbox');

    expect(unsafeHtml).toContain('<script');
    expect(unsafeHtml).toContain('onclick');
    expect(unsafeHtml).toContain('javascript:');
    expect(unsafeHtml).toContain('background-image');
    expect(unsafeHtml).toContain('font-size: 72px');
    expect(screen.getByRole('button', { name: '서버에 저장' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('직접 편집한 뒤 저장할 수 있습니다.');

    expect(editor).toHaveTextContent('event handler와 지원하지 않는 style은 제거됩니다.');
    expect(editor.innerHTML).not.toContain('<script');
    expect(editor.innerHTML).not.toContain('onclick');
    expect(editor.innerHTML).not.toContain('javascript:');
    expect(editor.innerHTML).not.toContain('background-image');
    expect(editor.innerHTML).not.toContain('font-size');

    act(() => {
      requireElement(editor.querySelector('p'), '편집기 문단').textContent =
        '안전 본문을 편집했습니다.';
      fireEvent.input(editor, { inputType: 'insertText', data: '편집' });
      editor.insertAdjacentHTML('beforeend', '<br class="ProseMirror-trailingBreak">');
    });
    await waitFor(() => expect(screen.getByRole('button', { name: '서버에 저장' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '서버에 저장' }));

    await waitFor(() => {
      const serverSnapshot = getServerSnapshot();

      expect(serverSnapshot).toHaveTextContent('안전 본문을 편집했습니다.');
      expect(serverSnapshot).not.toHaveTextContent('<script');
      expect(serverSnapshot).not.toHaveTextContent('onclick');
      expect(serverSnapshot).not.toHaveTextContent('javascript:');
      expect(serverSnapshot).not.toHaveTextContent('background-image');
      expect(serverSnapshot).not.toHaveTextContent('font-size');
      expect(serverSnapshot).not.toHaveTextContent('ProseMirror-trailingBreak');
    });
  });

  it('빈 문서 snapshot을 저장한 뒤 다시 편집해도 reload하면 빈 문서로 복귀한다', async () => {
    render(<App />);
    const editor = await screen.findByRole('textbox');

    act(() => {
      editor.innerHTML = '<p></p>';
      fireEvent.input(editor, { inputType: 'deleteContentBackward' });
    });
    await waitFor(() =>
      expect(screen.getByText('현재 편집값: 서버 저장값과 다릅니다.')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: '서버에 저장' }));
    await waitFor(() => expect(getServerSnapshot()).toHaveTextContent('(빈 문서)'));

    act(() => {
      editor.innerHTML = '<p>다시 편집한 값</p>';
      fireEvent.input(editor, { inputType: 'insertText', data: '값' });
    });
    await waitFor(() => expect(editor).toHaveTextContent('다시 편집한 값'));
    await waitFor(() =>
      expect(screen.getByText('현재 편집값: 서버 저장값과 다릅니다.')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: '저장값 다시 불러오기' }));

    await waitFor(() => expect(editor).not.toHaveTextContent('다시 편집한 값'));
    expect(getServerSnapshot()).toHaveTextContent('(빈 문서)');
  });

  it('formatting fixture의 headings, 목록, 링크, 정렬과 표를 editor에 보존한다', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '서식 fixture 불러오기' }));
    const editor = await screen.findByRole('textbox');

    expect(editor.querySelector('h1')).toHaveTextContent('HTML 편집기 demo');
    expect(editor.querySelector('h2')).toHaveTextContent('서식과 정렬');
    expect(editor.querySelector('ol')).toHaveTextContent('번호 목록');
    expect(editor.querySelector('ul')).toHaveTextContent('글머리 목록');
    expect(editor.querySelector('a')).toHaveAttribute('href', 'https://consumer.example/help');
    expect(editor.querySelector('p[style*="text-align: center"]')).toHaveTextContent(
      '가운데 정렬 문단',
    );
    expect(editor.querySelector('p[style*="text-align: right"]')).toHaveTextContent(
      '오른쪽 정렬 문단',
    );
    expect(editor.querySelector('table th')).toHaveTextContent('항목');
    expect(editor.querySelector('table td')).toHaveTextContent('첫 번째');
    expect(screen.getByRole('button', { name: '서버에 저장' })).toBeDisabled();
  });

  it('intro, table, image, unsafe fixture를 각각 이름으로 선택한다', async () => {
    render(<App />);
    const editor = await screen.findByRole('textbox');

    fireEvent.click(screen.getByRole('button', { name: '표 fixture 불러오기' }));
    await waitFor(() => expect(editor.querySelector('table')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '이미지 fixture 불러오기' }));
    await waitFor(() => expect(editor).toHaveTextContent('data URL 이미지'));

    fireEvent.click(screen.getByRole('button', { name: 'unsafe fixture 불러오기' }));
    await waitFor(() => expect(editor).toHaveTextContent('안전하지 않은 HTML'));

    fireEvent.click(screen.getByRole('button', { name: 'intro fixture 불러오기' }));
    await waitFor(() => expect(editor).toHaveTextContent('음성인식(STT)은'));
  });

  it('table selection DOM artifact가 있어도 server snapshot에는 모델 HTML만 저장한다', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '표 fixture 불러오기' }));
    const editor = await screen.findByRole('textbox');
    const cell = await screen.findByText('첫 번째');
    const tableCell = requireElement(cell.closest('td'), '표 cell');
    const paragraph = requireElement(tableCell.querySelector('p'), '표 cell 문단');

    expect(screen.getByRole('button', { name: '서버에 저장' })).toBeDisabled();

    act(() => {
      paragraph.textContent = '편집한 첫 번째';
      fireEvent.input(editor, { inputType: 'insertText', data: '편집' });
      tableCell.classList.add('selectedCell');
      editor.insertAdjacentHTML('beforeend', '<br class="ProseMirror-trailingBreak">');
    });
    await waitFor(() => expect(screen.getByRole('button', { name: '서버에 저장' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '서버에 저장' }));

    await waitFor(() => {
      const serverSnapshot = getServerSnapshot();

      expect(serverSnapshot).toHaveTextContent('표 cell은 테두리로 구분됩니다.');
      expect(serverSnapshot).toHaveTextContent('편집한 첫 번째');
      expect(serverSnapshot).toHaveTextContent('<table');
      expect(serverSnapshot).not.toHaveTextContent('selectedCell');
      expect(serverSnapshot).not.toHaveTextContent('ProseMirror-trailingBreak');
    });
  });
});
