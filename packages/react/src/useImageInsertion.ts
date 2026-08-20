import { isAllowedImageSrc } from '@cp949/simple-html-editor-core';
import type { Editor } from '@tiptap/core';
import { useCallback, useEffect, useRef, useState } from 'react';

const supportedImageTypes = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const supportedImageAccept = [...supportedImageTypes].join(',');

type ActivePicker = {
  input: HTMLInputElement;
  cleanup: () => void;
};

/** 브라우저 파일 선택과 clipboard 이미지를 안전한 data URL 이미지로 삽입한다. */
export function useImageInsertion(editor: Editor | null, readOnly: boolean) {
  const [error, setError] = useState<string | undefined>(undefined);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activePickerRef = useRef<ActivePicker | undefined>(undefined);
  const editorRef = useRef(editor);
  const mountedRef = useRef(false);
  const readOnlyRef = useRef(readOnly);

  editorRef.current = editor;
  readOnlyRef.current = readOnly;

  /** 현재 component와 editor에서만 비동기 작업 결과를 반영한다. */
  const canInsertInto = useCallback(
    (targetEditor: Editor | null): targetEditor is Editor =>
      mountedRef.current &&
      !readOnlyRef.current &&
      targetEditor !== null &&
      editorRef.current === targetEditor,
    [],
  );

  /** 활성 picker의 listener와 DOM을 함께 제거한다. */
  const clearActivePicker = useCallback(() => {
    activePickerRef.current?.cleanup();
  }, []);

  /** 오류를 잠시 알린 뒤 다음 이미지 작업을 위해 상태를 비운다. */
  const showError = useCallback((message: string) => {
    if (!mountedRef.current) {
      return;
    }

    if (errorTimerRef.current !== undefined) {
      clearTimeout(errorTimerRef.current);
    }

    setError(message);
    errorTimerRef.current = setTimeout(() => {
      setError(undefined);
      errorTimerRef.current = undefined;
    }, 4_000);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      clearActivePicker();

      if (errorTimerRef.current !== undefined) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, [clearActivePicker]);

  /** 허용된 파일을 읽고 검증한 뒤 현재 selection에 이미지 node를 삽입한다. */
  const insertFile = useCallback(
    async (file: File): Promise<boolean> => {
      const targetEditor = editorRef.current;

      if (!canInsertInto(targetEditor)) {
        return false;
      }

      if (!supportedImageTypes.has(file.type)) {
        showError('지원하지 않는 이미지 형식입니다.');
        return false;
      }

      try {
        const src = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
              return;
            }

            reject(new Error('data URL이 아닙니다.'));
          };
          reader.onerror = () => reject(reader.error ?? new Error('파일을 읽지 못했습니다.'));
          reader.readAsDataURL(file);
        });

        if (!canInsertInto(targetEditor)) {
          return false;
        }

        if (!isAllowedImageSrc(src)) {
          showError('지원하지 않는 이미지 형식입니다.');
          return false;
        }

        return targetEditor.chain().focus().setImage({ src, alt: file.name }).run();
      } catch {
        if (canInsertInto(targetEditor)) {
          showError('이미지를 읽지 못했습니다.');
        }
        return false;
      }
    },
    [canInsertInto, showError],
  );

  /** 임시 hidden input으로 파일 선택을 열고 완료 또는 취소 후 DOM에서 제거한다. */
  const pickImage = useCallback(() => {
    if (!canInsertInto(editorRef.current)) {
      return;
    }

    clearActivePicker();

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = supportedImageAccept;
    input.hidden = true;

    function cleanup(): void {
      input.removeEventListener('cancel', handleCancel);
      input.removeEventListener('change', handleChange);
      input.remove();

      if (activePickerRef.current?.input === input) {
        activePickerRef.current = undefined;
      }
    }

    function handleCancel(): void {
      cleanup();
    }

    function handleChange(): void {
      const file = input.files?.item(0);
      cleanup();

      if (file !== null && file !== undefined) {
        void insertFile(file);
      }
    }

    input.addEventListener('cancel', handleCancel, { once: true });
    input.addEventListener('change', handleChange, { once: true });
    activePickerRef.current = { input, cleanup };
    document.body.append(input);
    input.click();
  }, [canInsertInto, clearActivePicker, insertFile]);

  /** 지원 이미지 clipboard 항목만 소비하고 나머지는 ProseMirror 기본 paste로 넘긴다. */
  const handlePaste = useCallback(
    (event: ClipboardEvent): boolean => {
      if (!canInsertInto(editorRef.current)) {
        return false;
      }

      const item = Array.from(event.clipboardData?.items ?? []).find(
        (candidate) => candidate.kind === 'file' && supportedImageTypes.has(candidate.type),
      );
      const file = item?.getAsFile();

      if (file === null || file === undefined) {
        return false;
      }

      event.preventDefault();
      void insertFile(file);
      return true;
    },
    [canInsertInto, insertFile],
  );

  return { error, handlePaste, pickImage };
}
