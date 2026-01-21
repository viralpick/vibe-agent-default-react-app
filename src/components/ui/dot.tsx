import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/commerce-sdk";

const dotVariants = cva("inline-block rounded-full", {
  variants: {
    size: {
      small: "size-6",
      medium: "size-8",
      large: "size-12",
      xlarge: "size-16",
    },
    color: {
      gray: "bg-gray-400",
      red: "bg-red-400",
      green: "bg-green-400",
      blue: "bg-blue-400",
    },
  },
  defaultVariants: {
    size: "medium",
    color: "gray",
  },
});

/**
 * Dot 컴포넌트 Props
 *
 * @property {"small" | "medium" | "large" | "xlarge"} size - 점의 크기
 *   - `"small"`: 6px
 *   - `"medium"`: 8px (기본값)
 *   - `"large"`: 12px
 *   - `"xlarge"`: 16px
 *
 * @property {"gray" | "red" | "green" | "blue"} color - 점의 색상
 *   - `"gray"`: 회색 (기본값)
 *   - `"red"`: 빨간색
 *   - `"green"`: 초록색
 *   - `"blue"`: 파란색
 *
 * @example
 * ```tsx
 * // 기본 Dot
 * <Dot />
 *
 * // 크기와 색상 변형
 * <Dot size="large" color="green" />
 * <Dot size="xlarge" color="red" />
 *
 * // 텍스트와 함께 사용
 * <div className="flex items-center gap-8">
 *   <Dot color="green" />
 *   <span>Active</span>
 * </div>
 *
 * // 배지나 레이블에 상태 표시
 * <Badge leftIcon={<Dot color="blue" size="small" />}>Online</Badge>
 * ```
 */
export interface DotProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    VariantProps<typeof dotVariants> {}

/**
 * 상태나 알림을 표시하는 작은 원형 Dot 컴포넌트
 *
 * 다양한 크기와 색상을 지원하며,
 * 주로 상태 표시, 알림 인디케이터, 리스트 불릿 등에 사용됩니다.
 */
function Dot({ className, size, color, ...props }: DotProps) {
  return (
    <span
      data-slot="dot"
      className={cn(dotVariants({ size, color }), className)}
      {...props}
    />
  );
}

export { Dot };
