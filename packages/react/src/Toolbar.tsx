import { isAllowedLinkHref, selectedImageAlignment } from '@cp949/simple-html-editor-core';
import type { Editor } from '@tiptap/core';
import {
  AlignCenter,
  AlignCenterVertical,
  AlignEndVertical,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  Bold,
  DropletOff,
  ImagePlus,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link,
  List,
  ListOrdered,
  type LucideIcon,
  RemoveFormatting,
  Strikethrough,
  TextQuote,
  Underline,
  Unlink,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { ToolbarButton } from './ToolbarButton';
import { TableControls } from './TableControls';

type HeadingLevel = 1 | 2 | 3 | 4;

type TextAlignment = 'left' | 'center' | 'right';

const headingLevels: readonly HeadingLevel[] = [1, 2, 3, 4];

// 문단 정렬은 텍스트 줄 기준 아이콘을 사용한다.
const textAlignments = [
  { alignment: 'left', label: '왼쪽 정렬', icon: AlignLeft },
  { alignment: 'center', label: '가운데 정렬', icon: AlignCenter },
  { alignment: 'right', label: '오른쪽 정렬', icon: AlignRight },
] as const satisfies readonly { alignment: TextAlignment; label: string; icon: LucideIcon }[];

// 이미지 정렬은 문단 정렬과 구분하기 위해 개체 기준선 아이콘을 사용한다.
const imageAlignments = [
  { alignment: 'left', label: '이미지 왼쪽 정렬', icon: AlignStartVertical },
  { alignment: 'center', label: '이미지 가운데 정렬', icon: AlignCenterVertical },
  { alignment: 'right', label: '이미지 오른쪽 정렬', icon: AlignEndVertical },
] as const;

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
  // 이미지 selection은 문단 정렬의 대상이 아니므로 문단 정렬 판정에서 제외한다.
  const imageAlignment = selectedImageAlignment(editor.state);
  const isImageSelected = imageAlignment !== null;

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
    <div className="simple-html-editor__toolbar" role="toolbar" aria-label="서식 도구">
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
        icon={Bold}
        active={editor.isActive('bold')}
        disabled={readOnly || !editor.can().chain().focus().toggleBold().run()}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        label="기울임"
        icon={Italic}
        active={editor.isActive('italic')}
        disabled={readOnly || !editor.can().chain().focus().toggleItalic().run()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        label="밑줄"
        icon={Underline}
        active={editor.isActive('underline')}
        disabled={readOnly || !editor.can().chain().focus().toggleUnderline().run()}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolbarButton
        label="취소선"
        icon={Strikethrough}
        active={editor.isActive('strike')}
        disabled={readOnly || !editor.can().chain().focus().toggleStrike().run()}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <ToolbarButton
        label="인용구"
        icon={TextQuote}
        active={editor.isActive('blockquote')}
        disabled={readOnly || !editor.can().chain().focus().toggleBlockquote().run()}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarButton
        label="번호 목록"
        icon={ListOrdered}
        active={editor.isActive('orderedList')}
        disabled={readOnly || !editor.can().chain().focus().toggleOrderedList().run()}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        label="글머리 목록"
        icon={List}
        active={editor.isActive('bulletList')}
        disabled={readOnly || !editor.can().chain().focus().toggleBulletList().run()}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        label="들여쓰기"
        icon={IndentIncrease}
        disabled={readOnly || !editor.can().chain().focus().sinkListItem('listItem').run()}
        onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
      />
      <ToolbarButton
        label="내어쓰기"
        icon={IndentDecrease}
        disabled={readOnly || !editor.can().chain().focus().liftListItem('listItem').run()}
        onClick={() => editor.chain().focus().liftListItem('listItem').run()}
      />
      {textAlignments.map(({ alignment, label, icon }) => (
        <ToolbarButton
          key={alignment}
          label={label}
          icon={icon}
          active={
            !isImageSelected &&
            (alignment === 'left'
              ? !editor.isActive({ textAlign: 'center' }) &&
                !editor.isActive({ textAlign: 'right' })
              : editor.isActive({ textAlign: alignment }))
          }
          disabled={
            readOnly ||
            isImageSelected ||
            !editor.can().chain().focus().setTextAlign(alignment).run()
          }
          onClick={() => editor.chain().focus().setTextAlign(alignment).run()}
        />
      ))}
      {imageAlignments.map(({ alignment, label, icon }) => (
        <ToolbarButton
          key={alignment}
          label={label}
          icon={icon}
          active={imageAlignment === alignment}
          disabled={readOnly || !editor.can().setImageAlignment(alignment)}
          onClick={() => editor.commands.setImageAlignment(alignment)}
        />
      ))}
      <ToolbarButton
        label="링크 설정"
        icon={Link}
        active={editor.isActive('link')}
        disabled={
          readOnly || !editor.can().chain().focus().setLink({ href: 'https://example.com' }).run()
        }
        onClick={setLink}
      />
      <ToolbarButton
        label="링크 제거"
        icon={Unlink}
        disabled={readOnly || !editor.can().chain().focus().unsetLink().run()}
        onClick={() => editor.chain().focus().unsetLink().run()}
      />
      <ToolbarButton
        label="이미지 추가"
        icon={ImagePlus}
        disabled={readOnly || onPickImage === undefined}
        onClick={() => onPickImage?.()}
      />
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
        icon={DropletOff}
        disabled={readOnly || !editor.can().chain().focus().unsetColor().run()}
        onClick={() => editor.chain().focus().unsetColor().run()}
      />
      <ToolbarButton
        label="서식 지우기"
        icon={RemoveFormatting}
        disabled={readOnly || !editor.can().chain().focus().unsetAllMarks().clearNodes().run()}
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
      />
      <TableControls editor={editor} readOnly={readOnly} />
    </div>
  );
}
