import { createHtmlEditorExtensions, isEditorDocumentEmpty } from '@cp949/simple-html-editor-core';
import Placeholder from '@tiptap/extension-placeholder';
import { AllSelection, NodeSelection, Selection } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import { Toolbar } from './Toolbar';
import { createImageNodeViewRenderer } from './createImageNodeViewRenderer';
import type { HtmlEditorHandle, HtmlEditorProps } from './types';
import { useImageInsertion } from './useImageInsertion';

const imageNodeViewRenderer = createImageNodeViewRenderer();

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
      ...createHtmlEditorExtensions(imageNodeViewRenderer),
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
    if (
      editor &&
      readOnly &&
      editor.state.selection instanceof NodeSelection &&
      editor.state.selection.node.type.name === 'image'
    ) {
      const nearbySelection = Selection.near(
        editor.state.doc.resolve(editor.state.selection.from),
        -1,
      );
      const selection =
        nearbySelection instanceof NodeSelection
          ? new AllSelection(editor.state.doc)
          : nearbySelection;
      editor.view.dispatch(editor.state.tr.setSelection(selection));
    }

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

  useEffect(
    () => () => {
      editor?.destroy();
    },
    [editor],
  );

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
