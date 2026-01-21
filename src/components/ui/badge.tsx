import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/commerce-sdk";

const badgeVariants = cva(
  "inline-flex items-center justify-center font-medium whitespace-nowrap shrink-0 transition-all",
  {
    variants: {
      size: {
        lg: "h-28 px-6 py-4 gap-4 text-body-s [&>svg]:size-16",
        sm: "h-20 px-4 py-2 gap-4 text-label-m [&>svg]:size-12",
      },
      shape: {
        rounded: "rounded-round",
        pill: "rounded-small",
      },
      badgeStyle: {
        light: "",
        filled: "",
      },
      theme: {
        red: "",
        purple: "",
        slate: "",
        gray: "",
        blue: "",
        green: "",
        yellow: "",
      },
      outline: {
        true: "border",
        false: "border-0",
      },
      active: {
        true: "opacity-100",
        false: "opacity-50",
      },
    },
    compoundVariants: [
      // Red theme
      {
        theme: "red",
        badgeStyle: "light",
        className: "bg-red-50 text-red-600",
      },
      {
        theme: "red",
        badgeStyle: "filled",
        className: "bg-red-500 text-gray-0",
      },
      { theme: "red", outline: true, className: "border-opacity-10" },

      // Purple theme
      {
        theme: "purple",
        badgeStyle: "light",
        className: "bg-purple-50 text-purple-600",
      },
      {
        theme: "purple",
        badgeStyle: "filled",
        className: "bg-purple-500 text-gray-0",
      },
      { theme: "purple", outline: true, className: "border-opacity-10" },

      // Slate theme
      {
        theme: "slate",
        badgeStyle: "light",
        className: "bg-slate-200 text-slate-600",
      },
      {
        theme: "slate",
        badgeStyle: "filled",
        className: "bg-slate-600 text-gray-0",
      },
      { theme: "slate", outline: true, className: "border-opacity-10" },

      // Gray theme
      {
        theme: "gray",
        badgeStyle: "light",
        className: "bg-gray-200 text-gray-800",
      },
      {
        theme: "gray",
        badgeStyle: "filled",
        className: "bg-gray-900 text-gray-0",
      },
      { theme: "gray", outline: true, className: "border-opacity-10" },

      // Blue theme
      {
        theme: "blue",
        badgeStyle: "light",
        className: "bg-blue-50 text-blue-600",
      },
      {
        theme: "blue",
        badgeStyle: "filled",
        className: "bg-blue-500 text-gray-0",
      },
      { theme: "blue", outline: true, className: "border-opacity-10" },

      // Green theme
      {
        theme: "green",
        badgeStyle: "light",
        className: "bg-green-50 text-green-600",
      },
      {
        theme: "green",
        badgeStyle: "filled",
        className: "bg-green-500 text-gray-0",
      },
      { theme: "green", outline: true, className: "border-opacity-10" },

      // Yellow theme
      {
        theme: "yellow",
        badgeStyle: "light",
        className: "bg-yellow-50 text-yellow-700",
      },
      {
        theme: "yellow",
        badgeStyle: "filled",
        className: "bg-yellow-500 text-gray-0",
      },
      { theme: "yellow", outline: true, className: "border-opacity-10" },
    ],
    defaultVariants: {
      size: "sm",
      shape: "rounded",
      badgeStyle: "light",
      theme: "gray",
      outline: false,
      active: true,
    },
  }
);

/**
 * Badge 컴포넌트 Props
 *
 * @property {"lg" | "sm"} size - 배지 크기
 *   - `"lg"`: 큰 크기 (height: 28px)
 *   - `"sm"`: 작은 크기 (height: 20px, 기본값)
 *
 * @property {"rounded" | "pill"} shape - 배지 모양
 *   - `"rounded"`: 완전히 둥근 모양 (기본값)
 *   - `"pill"`: 약간 둥근 모서리
 *
 * @property {"light" | "filled"} badgeStyle - 배지 스타일
 *   - `"light"`: 밝은 배경에 진한 텍스트 (기본값)
 *   - `"filled"`: 진한 배경에 흰색 텍스트
 *
 * @property {"red" | "purple" | "slate" | "gray" | "blue" | "green" | "yellow"} theme - 색상 테마
 *   - 7가지 색상 테마 지원 (기본값: "gray")
 *
 * @property {boolean} outline - 테두리 표시 여부
 * @property {boolean} active - 활성화 상태 (false일 때 50% 투명도)
 * @property {ReactNode} leftIcon - 텍스트 왼쪽에 표시되는 아이콘
 * @property {ReactNode} rightIcon - 텍스트 오른쪽에 표시되는 아이콘
 *
 * @example
 * ```tsx
 * // 기본 배지
 * <Badge>New</Badge>
 *
 * // 색상과 스타일 변형
 * <Badge theme="blue" badgeStyle="filled">Premium</Badge>
 * <Badge theme="green" size="lg" outline>Active</Badge>
 *
 * // 아이콘 포함
 * <Badge leftIcon={<CheckIcon />} theme="green">Verified</Badge>
 * <Badge rightIcon={<XIcon />}>Dismissible</Badge>
 *
 * // 비활성 상태
 * <Badge active={false}>Inactive</Badge>
 * ```
 */
export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/**
 * 짧은 텍스트나 상태를 표시하는 Badge 컴포넌트
 *
 * 다양한 색상 테마와 스타일 옵션을 제공하며,
 * 좌우에 아이콘을 추가할 수 있습니다.
 */
function Badge({
  className,
  size,
  shape,
  badgeStyle,
  theme,
  outline,
  active,
  leftIcon,
  rightIcon,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      data-slot="custom-badge"
      className={cn(
        badgeVariants({
          size,
          shape,
          badgeStyle,
          theme,
          outline,
          active,
        }),
        className
      )}
      {...props}
    >
      {leftIcon && <span className="shrink-0 w-16 h-16">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="shrink-0 w-16 h-16">{rightIcon}</span>}
    </span>
  );
}

export { Badge };
