import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/commerce-sdk";

const labelVariants = cva(
  "text-label-2 text-text-primary leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
  {
    variants: {
      required: {
        true: "after:content-['*'] after:ml-4 after:text-text-error",
        false: "",
      },
    },
    defaultVariants: {
      required: false,
    },
  }
);

/**
 * Label 컴포넌트 Props
 *
 * @property {boolean} required - 필수 입력 표시 여부 (기본값: false)
 *   - true일 때 레이블 뒤에 빨간색 별표(*) 표시
 *
 * @example
 * ```tsx
 * // 기본 레이블
 * <Label htmlFor="email">이메일</Label>
 *
 * // 필수 입력 레이블
 * <Label htmlFor="name" required>이름</Label>
 * ```
 */
export interface LabelProps
  extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>,
    VariantProps<typeof labelVariants> {}

/**
 * 폼 입력 필드와 연결되는 Label 컴포넌트
 *
 * Radix UI Label을 래핑하여 디자인 시스템 스타일을 적용합니다.
 * htmlFor 속성으로 연결된 input과 자동으로 연결됩니다.
 */
const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  LabelProps
>(({ className, required, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    data-slot="label"
    className={cn(labelVariants({ required }), className)}
    {...props}
  />
));

Label.displayName = "Label";

export { Label, labelVariants };
