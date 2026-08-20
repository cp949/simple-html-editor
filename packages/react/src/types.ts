/** HTML 편집기에 명령을 전달하는 공개 handle */
export interface HtmlEditorHandle {
  /** 편집 영역으로 포커스 이동 */
  focus(): void;
}

/** 제어형 HTML 편집기의 공개 props */
export interface HtmlEditorProps {
  /** 편집기에 표시할 HTML. undefined는 빈 문서 */
  value?: string;

  /** 사용자 편집 후 정규화된 HTML. 빈 문서는 undefined */
  onChange: (html: string | undefined) => void;

  /** 편집 영역이 포커스를 잃을 때의 알림 */
  onBlur?: () => void;

  /** 빈 문서에 표시할 안내 문구 */
  placeholder?: string;

  /** 사용자 편집 차단 여부 */
  readOnly?: boolean;

  /** HtmlEditor 최상위 요소에 전달할 클래스 이름 */
  className?: string;
}
