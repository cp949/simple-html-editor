import { isAllowedLinkHref } from '@cp949/editor-simple-core';
import type { Editor } from '@tiptap/core';
import { useEffect, useState } from 'react';

import { ToolbarButton } from './ToolbarButton';
import { TableControls } from './TableControls';

type HeadingLevel = 1 | 2 | 3 | 4;

const headingLevels: readonly HeadingLevel[] = [1, 2, 3, 4];

/** HtmlEditor 내부에서만 Tiptap command를 접근 가능한 control로 제공한다. */
export function Toolbar({
  editor,
  readOnly,
  onPickImage,
}: {
  editor: Editor;
  readOnly: boolean;
  onPickImage?: () => void;
}) {
  const [, setRevision] = useState(0);

  useEffect(() => {
    // command 후 활성 상태와 실행 가능 여부를 다시 계산한다.
    const refresh = () => setRevision((revision) => revision + 1);
    editor.on('transaction', refresh);

    return () => {
      editor.off('transaction', refresh);
    };
  }, [editor]);

  // 현재 selection에서 링크 주소를 얻어 prompt의 기본값으로 사용한다.
  const setLink = () => {
    const href = editor.getAttributes('link').href as string | undefined;
    const nextHref = window.prompt('링크 주소', href ?? '');

    if (nextHref === null) {
      return;
    }

    if (nextHref === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }

    if (isAllowedLinkHref(nextHref)) {
      editor.chain().focus().setLink({ href: nextHref }).run();
    }
  };

  return (
    <div className="editor-simple__toolbar" role="toolbar" aria-label="서식 도구">
      <ToolbarButton
        label="문단"
        active={editor.isActive('paragraph')}
        disabled={readOnly || !editor.can().chain().focus().setParagraph().run()}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        문단
      </ToolbarButton>
      {headingLevels.map((level) => (
        <ToolbarButton
          key={level}
          label={`제목 ${level}`}
          active={editor.isActive('heading', { level })}
          disabled={readOnly || !editor.can().chain().focus().toggleHeading({ level }).run()}
          onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
        >
          제목 {level}
        </ToolbarButton>
      ))}
      <ToolbarButton
        label="굵게"
        active={editor.isActive('bold')}
        disabled={readOnly || !editor.can().chain().focus().toggleBold().run()}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        굵게
      </ToolbarButton>
      <ToolbarButton
        label="기울임"
        active={editor.isActive('italic')}
        disabled={readOnly || !editor.can().chain().focus().toggleItalic().run()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        기울임
      </ToolbarButton>
      <ToolbarButton
        label="밑줄"
        active={editor.isActive('underline')}
        disabled={readOnly || !editor.can().chain().focus().toggleUnderline().run()}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        밑줄
      </ToolbarButton>
      <ToolbarButton
        label="취소선"
        active={editor.isActive('strike')}
        disabled={readOnly || !editor.can().chain().focus().toggleStrike().run()}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        취소선
      </ToolbarButton>
      <ToolbarButton
        label="인용구"
        active={editor.isActive('blockquote')}
        disabled={readOnly || !editor.can().chain().focus().toggleBlockquote().run()}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        인용구
      </ToolbarButton>
      <ToolbarButton
        label="번호 목록"
        active={editor.isActive('orderedList')}
        disabled={readOnly || !editor.can().chain().focus().toggleOrderedList().run()}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        번호 목록
      </ToolbarButton>
      <ToolbarButton
        label="글머리 목록"
        active={editor.isActive('bulletList')}
        disabled={readOnly || !editor.can().chain().focus().toggleBulletList().run()}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        글머리 목록
      </ToolbarButton>
      <ToolbarButton
        label="들여쓰기"
        disabled={readOnly || !editor.can().chain().focus().sinkListItem('listItem').run()}
        onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
      >
        들여쓰기
      </ToolbarButton>
      <ToolbarButton
        label="내어쓰기"
        disabled={readOnly || !editor.can().chain().focus().liftListItem('listItem').run()}
        onClick={() => editor.chain().focus().liftListItem('listItem').run()}
      >
        내어쓰기
      </ToolbarButton>
      {(['left', 'center', 'right'] as const).map((alignment) => {
        const label = { left: '왼쪽 정렬', center: '가운데 정렬', right: '오른쪽 정렬' }[alignment];

        return (
          <ToolbarButton
            key={alignment}
            label={label}
            active={
              alignment === 'left'
                ? !editor.isActive({ textAlign: 'center' }) &&
                  !editor.isActive({ textAlign: 'right' })
                : editor.isActive({ textAlign: alignment })
            }
            disabled={readOnly || !editor.can().chain().focus().setTextAlign(alignment).run()}
            onClick={() => editor.chain().focus().setTextAlign(alignment).run()}
          >
            {label}
          </ToolbarButton>
        );
      })}
      <ToolbarButton
        label="링크 설정"
        active={editor.isActive('link')}
        disabled={
          readOnly || !editor.can().chain().focus().setLink({ href: 'https://example.com' }).run()
        }
        onClick={setLink}
      >
        링크 설정
      </ToolbarButton>
      <ToolbarButton
        label="링크 제거"
        disabled={readOnly || !editor.can().chain().focus().unsetLink().run()}
        onClick={() => editor.chain().focus().unsetLink().run()}
      >
        링크 제거
      </ToolbarButton>
      <ToolbarButton
        label="이미지 추가"
        disabled={readOnly || onPickImage === undefined}
        onClick={() => onPickImage?.()}
      >
        이미지 추가
      </ToolbarButton>
      <input
        type="color"
        aria-label="글자색"
        disabled={readOnly}
        onMouseDown={(event) => event.preventDefault()}
        onChange={(event) => {
          if (!readOnly) {
            editor.chain().focus().setColor(event.target.value).run();
          }
        }}
      />
      <ToolbarButton
        label="글자색 제거"
        disabled={readOnly || !editor.can().chain().focus().unsetColor().run()}
        onClick={() => editor.chain().focus().unsetColor().run()}
      >
        글자색 제거
      </ToolbarButton>
      <ToolbarButton
        label="서식 지우기"
        disabled={readOnly || !editor.can().chain().focus().unsetAllMarks().clearNodes().run()}
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
      >
        서식 지우기
      </ToolbarButton>
      <TableControls editor={editor} readOnly={readOnly} />
    </div>
  );
}
