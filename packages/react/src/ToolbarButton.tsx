import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ToolbarButtonBaseProps = {
  /** 보조 기술에 전달할 command 이름 */
  label: string;

  /** 현재 selection에 command가 적용된 상태 */
  active?: boolean;

  /** 현재 selection에서 command를 실행할 수 없는 상태 */
  disabled?: boolean;

  /** 선택을 보존한 뒤 실행할 command */
  onClick: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
};

/** 아이콘 전용 표현과 텍스트 전용 표현 중 하나만 선택하도록 강제한다. */
type ToolbarButtonProps = ToolbarButtonBaseProps &
  (
    | {
        /** 작업 의미를 나타내는 Lucide 아이콘 */
        icon: LucideIcon;
        children?: never;
      }
    | {
        icon?: never;

        /** 버튼에 표시할 짧은 이름 */
        children: ReactNode;
      }
  );

/** 편집기 selection을 보존하면서 command를 실행하는 toolbar 버튼이다. */
export function ToolbarButton({
  label,
  icon: Icon,
  active = false,
  disabled = false,
  onClick,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      // 아이콘만 표시하는 버튼은 tooltip으로 의미를 확인할 수 있어야 한다.
      title={Icon ? label : undefined}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {Icon ? <Icon aria-hidden="true" focusable="false" /> : children}
    </button>
  );
}
