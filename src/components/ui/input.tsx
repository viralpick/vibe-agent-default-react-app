/**
 * @component Input
 * @description Single-line text input field with consistent styling.
 * Supports all native input types (text, email, password, number, etc.).
 *
 * @designTokens h-9, rounded-medium, px-3, text-label-l
 * @useCase Form fields, search inputs, filters
 */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/commerce-sdk";

const inputVariants = cva(
  "inline-flex items-center bg-gray-0 gap-1 rounded-medium transition-all focus-within:ring-2 focus-within:ring-border-brand focus-within:ring-offset-1",
  {
    variants: {
      size: {
        sm: "h-8 px-2.5 py-1.5",
        md: "h-10 p-2.5",
      },
      isFilled: {
        true: "",
        false: ""
      },
    },
    defaultVariants: {
      size: "md",
      isFilled: false,
    },
  }
);

/**
 * Input 컴포넌트 Props
 *
 * @property {"sm" | "md"} size - 입력 필드 크기
 *   - `"sm"`: 작은 크기 (height: 32px)
 *   - `"md"`: 중간 크기 (height: 40px, 기본값)
 *
 * @property {ReactNode} leadIcon - 입력 필드 앞의 아이콘
 * @property {ReactNode} tailIcon - 입력 필드 뒤의 아이콘
 * @property {ReactNode} badge - 입력 필드와 tailIcon 사이의 배지
 *
 * @description
 * - filled 상태는 자동 판단: value 또는 defaultValue가 있으면 흰색 배경
 * - disabled 상태는 HTML 네이티브 disabled prop 사용
 *
 * @example
 * ```tsx
 * // 기본 Input
 * <Input placeholder="이름을 입력하세요" />
 *
 * // 검색 Input (filled 스타일 자동 적용)
 * <Input
 *   leadIcon={<SearchIcon />}
 *   placeholder="검색..."
 *   badge={<Badge>⌘E</Badge>}
 *   tailIcon={<InfoIcon />}
 *   defaultValue="initial value"
 * />
 *
 * // 비활성화된 Input
 * <Input disabled value="비활성" />
 * ```
 */
export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    Omit<VariantProps<typeof inputVariants>, "isFilled"> {
  leadIcon?: React.ReactNode;
  tailIcon?: React.ReactNode;
  badge?: React.ReactNode;
}

/**
 * 텍스트 입력을 위한 Input 컴포넌트
 *
 * value 또는 defaultValue가 있으면 자동으로 filled 스타일(흰색 배경)이 적용됩니다.
 * leadIcon, tailIcon, badge를 선택적으로 추가할 수 있습니다.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      size,
      leadIcon,
      tailIcon,
      badge,
      value,
      defaultValue,
      disabled,
      ...props
    },
    ref
  ) => {
    // value 또는 defaultValue가 있으면 자동으로 filled 스타일 적용
    const isFilled = !!(value || defaultValue);

    return (
      <div
        className={cn(
          inputVariants({ size, isFilled }),
          disabled && "opacity-20 cursor-not-allowed",
          className
        )}
      >
        {leadIcon && (
          <span className="shrink-0 text-icon-secondary [&>svg]:size-4">
            {leadIcon}
          </span>
        )}
        <input
          ref={ref}
          value={value}
          defaultValue={defaultValue}
          disabled={disabled}
          className="flex-1 bg-transparent text-label-2 text-text-primary placeholder:text-text-tertiary outline-none disabled:cursor-not-allowed"
          {...props}
        />
        {badge && <span className="shrink-0">{badge}</span>}
        {tailIcon && (
          <span className="shrink-0 text-icon-secondary [&>svg]:size-4">
            {tailIcon}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input, inputVariants };
