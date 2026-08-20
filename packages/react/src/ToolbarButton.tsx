import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** 편집기 selection을 보존하면서 command를 실행하는 toolbar 버튼이다. */
export function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  /** 보조 기술에 전달할 command 이름 */
  label: string;

  /** 현재 selection에 command가 적용된 상태 */
  active?: boolean;

  /** 현재 selection에서 command를 실행할 수 없는 상태 */
  disabled?: boolean;

  /** 선택을 보존한 뒤 실행할 command */
  onClick: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];

  /** 버튼에 표시할 짧은 이름 */
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
