import { createHtmlEditorExtensions, isEditorDocumentEmpty } from '@cp949/editor-simple-core';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import { Toolbar } from './Toolbar';
import type { HtmlEditorHandle, HtmlEditorProps } from './types';
import { useImageInsertion } from './useImageInsertion';

/** 외부 HTML 값과 사용자 편집을 연결하는 제어형 편집기다. */
export const HtmlEditor = forwardRef<HtmlEditorHandle, HtmlEditorProps>(function HtmlEditor(
  { value, onChange, onBlur, placeholder, readOnly = false, className },
  ref,
) {
  const lastReceivedExternalValueRef = useRef(value);
  const lastEmittedHtmlRef = useRef<string | undefined>(undefined);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      ...createHtmlEditorExtensions(),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: value ?? '',
    editable: !readOnly,
    onUpdate: ({ editor: updatedEditor }) => {
      const html = isEditorDocumentEmpty(updatedEditor.getJSON())
        ? undefined
        : updatedEditor.getHTML();
      lastEmittedHtmlRef.current = html;
      onChange(html);
    },
    onBlur,
  });
  const { error: imageError, handlePaste, pickImage } = useImageInsertion(editor, readOnly);

  useImperativeHandle(
    ref,
    () => ({
      focus() {
        editor?.commands.focus();
      },
    }),
    [editor],
  );

  useEffect(() => {
    editor?.setEditable(!readOnly, false);

    if (editor) {
      editor.view.dom.setAttribute('aria-readonly', String(readOnly));
    }
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.view.dom.setAttribute('role', 'textbox');
    editor.view.dom.setAttribute('aria-label', 'HTML 편집 내용');
    editor.view.dom.setAttribute('aria-multiline', 'true');
  }, [editor]);

  useEffect(() => {
    const externalValueChanged = lastReceivedExternalValueRef.current !== value;
    lastReceivedExternalValueRef.current = value;

    if (!editor || !externalValueChanged) {
      return;
    }

    const currentHtml = isEditorDocumentEmpty(editor.getJSON()) ? undefined : editor.getHTML();

    if (value === lastEmittedHtmlRef.current && value === currentHtml) {
      return;
    }

    if (value !== currentHtml) {
      editor.commands.setContent(value ?? '', { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <div className={['editor-simple', className].filter(Boolean).join(' ')}>
      {editor ? <Toolbar editor={editor} readOnly={readOnly} onPickImage={pickImage} /> : null}
      {imageError ? <p role="status">{imageError}</p> : null}
      <EditorContent
        editor={editor}
        className="editor-simple__content"
        onPasteCapture={(event) => {
          handlePaste(event.nativeEvent);
        }}
      />
    </div>
  );
});
