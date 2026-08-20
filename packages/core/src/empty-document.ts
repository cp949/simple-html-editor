import type { JSONContent } from '@tiptap/core';

function hasMeaningfulContent(node: JSONContent): boolean {
  if (node.type === 'text' && node.text?.trim()) {
    return true;
  }

  if (node.type === 'image' || node.type === 'table') {
    return true;
  }

  return node.content?.some(hasMeaningfulContent) ?? false;
}

/** Tiptap 문서에 저장할 텍스트, 이미지 또는 표가 있는지 판정한다. */
export function isEditorDocumentEmpty(document: JSONContent): boolean {
  return !hasMeaningfulContent(document);
}
