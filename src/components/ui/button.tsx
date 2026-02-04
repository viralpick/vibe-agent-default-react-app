/**
 * @component Button
 * @description Interactive button with multiple variants and sizes.
 * Variants: default, destructive, outline, secondary, ghost, link.
 * Sizes: default (36px), sm (32px), lg (40px), icon, icon-sm, icon-lg.
 *
 * @useCase Primary actions, form submissions, navigation, icon buttons
 */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/commerce-sdk";

const buttonVariants = cva(
  "inline-flex items-center justify-center font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
  {
    variants: {
      buttonStyle: {
        primary: "",
        secondary: "border",
        tertiary: "",
        ghost: "bg-transparent",
      },
      size: {
        lg: "",
        md: "",
        sm: "",
        xs: "",
      },
      target: {
        default: "",
        destructive: "",
        brand: "",
      },
      buttonType: {
        default: "rounded-medium",
        icon: "rounded-medium",
      },
    },
    compoundVariants: [
      // ============================================
      // Default target
      // ============================================
      // Default + Primary
      {
        target: "default",
        buttonStyle: "primary",
        className:
          "bg-button-primary text-text-inverted [&_svg]:text-icon-inverted hover:bg-button-primary-hover disabled:bg-button-primary-disabled disabled:text-text-inverted-disabled disabled:[&_svg]:text-icon-inverted-disabled focus-visible:ring-gray-900",
      },
      // Default + Secondary
      {
        target: "default",
        buttonStyle: "secondary",
        className:
          "bg-button-secondary border-border-200 text-text-primary [&_svg]:text-icon-secondary hover:bg-button-secondary-hover hover:border-border-200-hover disabled:bg-button-secondary-disabled disabled:text-text-primary-disabled disabled:[&_svg]:text-icon-secondary-disabled disabled:border-gray-200 focus-visible:ring-gray-900",
      },
      // Default + Tertiary
      {
        target: "default",
        buttonStyle: "tertiary",
        className:
          "bg-button-tertiary text-text-primary [&_svg]:text-icon-secondary hover:bg-button-tertiary-hover disabled:bg-button-tertiary-disabled disabled:text-text-primary-disabled disabled:[&_svg]:text-icon-secondary-disabled focus-visible:ring-gray-900",
      },
      // Default + Ghost
      {
        target: "default",
        buttonStyle: "ghost",
        className:
          "bg-button-ghost text-text-primary [&_svg]:text-icon-secondary enabled:hover:bg-button-ghost-hover disabled:bg-button-ghost-disabled disabled:text-text-primary-disabled disabled:[&_svg]:text-icon-secondary-disabled focus-visible:ring-gray-900",
      },

      // ============================================
      // Destructive target
      // ============================================
      // Destructive + Primary
      {
        target: "destructive",
        buttonStyle: "primary",
        className:
          "bg-button-destructive text-text-inverted [&_svg]:text-icon-inverted hover:bg-button-destructive-hover disabled:bg-button-destructive-disabled disabled:text-text-inverted-disabled disabled:[&_svg]:text-icon-inverted-disabled focus-visible:ring-red-500",
      },
      // Destructive + Secondary
      {
        target: "destructive",
        buttonStyle: "secondary",
        className:
          "bg-button-secondary border-border-error text-text-error [&_svg]:text-icon-error hover:bg-button-secondary-hover hover:border-border-error-hover disabled:bg-button-secondary-disabled disabled:text-red-200 disabled:[&_svg]:text-red-200 disabled:border-red-200 focus-visible:ring-red-500",
      },
      // Destructive + Tertiary
      {
        target: "destructive",
        buttonStyle: "tertiary",
        className:
          "bg-red-50 text-text-error [&_svg]:text-icon-error hover:bg-red-100 disabled:bg-red-50 disabled:text-red-200 disabled:[&_svg]:text-red-200 focus-visible:ring-red-500",
      },
      // Destructive + Ghost
      {
        target: "destructive",
        buttonStyle: "ghost",
        className:
          "bg-button-ghost text-text-error [&_svg]:text-icon-error enabled:hover:bg-red-50 disabled:bg-button-ghost-disabled disabled:text-red-200 disabled:[&_svg]:text-red-200 focus-visible:ring-red-500",
      },

      // ============================================
      // Brand target
      // ============================================
      // Brand + Primary
      {
        target: "brand",
        buttonStyle: "primary",
        className:
          "bg-button-brand text-text-inverted [&_svg]:text-icon-inverted hover:bg-button-brand-hover disabled:bg-button-brand-disabled disabled:text-text-inverted-disabled disabled:[&_svg]:text-icon-inverted-disabled focus-visible:ring-blue-500",
      },
      // Brand + Secondary
      {
        target: "brand",
        buttonStyle: "secondary",
        className:
          "bg-button-secondary border-border-brand text-text-brand [&_svg]:text-icon-brand hover:bg-button-secondary-hover hover:border-border-brand-hover disabled:bg-button-secondary-disabled disabled:text-blue-200 disabled:[&_svg]:text-blue-200 disabled:border-blue-200 focus-visible:ring-blue-500",
      },
      // Brand + Tertiary
      {
        target: "brand",
        buttonStyle: "tertiary",
        className:
          "bg-blue-50 text-text-brand [&_svg]:text-icon-brand hover:bg-blue-100 disabled:bg-blue-50 disabled:text-blue-200 disabled:[&_svg]:text-blue-200 focus-visible:ring-blue-500",
      },
      // Brand + Ghost
      {
        target: "brand",
        buttonStyle: "ghost",
        className:
          "bg-button-ghost text-text-brand [&_svg]:text-icon-brand enabled:hover:bg-blue-50 disabled:bg-button-ghost-disabled disabled:text-blue-200 disabled:[&_svg]:text-blue-200 focus-visible:ring-blue-500",
      },

      // ============================================
      // Size variants for default type (text buttons)
      // ============================================
      {
        buttonType: "default",
        size: "lg",
        className: "h-12 px-4 py-3 gap-2 text-label-1 [&_svg]:size-5",
      },
      {
        buttonType: "default",
        size: "md",
        className: "h-10 px-3 py-2.5 gap-1.5 text-label-2 [&_svg]:size-5",
      },
      {
        buttonType: "default",
        size: "sm",
        className: "h-8 px-2 py-1.5 gap-1 text-label-3 [&_svg]:size-5",
      },
      {
        buttonType: "default",
        size: "xs",
        className: "h-6 px-1 py-1 gap-1 text-label-4 [&_svg]:size-5",
      },

      // ============================================
      // Size variants for icon type (icon-only buttons)
      // ============================================
      {
        buttonType: "icon",
        size: "lg",
        className: "size-12 [&_svg]:size-5",
      },
      {
        buttonType: "icon",
        size: "md",
        className: "size-10 [&_svg]:size-5",
      },
      {
        buttonType: "icon",
        size: "sm",
        className: "size-8 [&_svg]:size-4",
      },
      {
        buttonType: "icon",
        size: "xs",
        className: "size-6 [&_svg]:size-4",
      },
    ],
    defaultVariants: {
      buttonStyle: "primary",
      size: "md",
      target: "default",
      buttonType: "default",
    },
  }
);

/**
 * Button 컴포넌트 Props
 *
 * @property {"primary" | "secondary" | "tertiary" | "ghost"} buttonStyle - 버튼 스타일
 *   - `"primary"`: 기본 배경색 버튼 (기본값)
 *   - `"secondary"`: 테두리가 있는 버튼
 *   - `"tertiary"`: 배경색이 연한 버튼
 *   - `"ghost"`: 투명 배경 버튼
 *
 * @property {"lg" | "md" | "sm" | "xs"} size - 버튼 크기
 *   - `"lg"`: 큰 크기 (height: 48px)
 *   - `"md"`: 중간 크기 (height: 40px, 기본값)
 *   - `"sm"`: 작은 크기 (height: 32px)
 *   - `"xs"`: 최소 크기 (height: 24px)
 *
 * @property {"default" | "destructive" | "brand"} target - 버튼 용도/색상
 *   - `"default"`: 일반 회색 계열 (기본값)
 *   - `"destructive"`: 삭제/경고용 빨간색 계열
 *   - `"brand"`: 브랜드 파란색 계열
 *
 * @property {"default" | "icon"} buttonType - 버튼 타입
 *   - `"default"`: 텍스트 버튼 (기본값)
 *   - `"icon"`: 아이콘 전용 정사각형 버튼
 *
 * @property {ReactNode} leadIcon - 텍스트 앞에 표시되는 아이콘
 * @property {ReactNode} tailIcon - 텍스트 뒤에 표시되는 아이콘
 * @property {ReactNode} badge - 텍스트와 tailIcon 사이에 표시되는 배지
 * @property {boolean} asChild - Radix UI Slot 사용 여부 (자식을 버튼으로 변환)
 *
 * @example
 * ```tsx
 * // 기본 버튼
 * <Button>Click me</Button>
 *
 * // 스타일과 크기 변형
 * <Button buttonStyle="secondary" size="lg">Large Secondary</Button>
 * <Button buttonStyle="ghost" target="brand">Brand Ghost</Button>
 *
 * // 아이콘 포함
 * <Button leadIcon={<PlusIcon />}>Add Item</Button>
 * <Button tailIcon={<ArrowRightIcon />}>Next</Button>
 *
 * // 아이콘 전용 버튼
 * <Button buttonType="icon" size="sm">
 *   <SearchIcon />
 * </Button>
 *
 * // 삭제/경고 버튼
 * <Button target="destructive">Delete</Button>
 *
 * // 배지 포함
 * <Button badge={<Badge>New</Badge>}>Features</Button>
 *
 * // asChild로 링크를 버튼 스타일로 렌더링
 * <Button asChild>
 *   <a href="/login">Login</a>
 * </Button>
 * ```
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  leadIcon?: React.ReactNode;
  tailIcon?: React.ReactNode;
  badge?: React.ReactNode;
  asChild?: boolean;
}

/**
 * 다양한 스타일과 크기를 지원하는 Button 컴포넌트
 *
 * 3가지 색상 테마(default, destructive, brand)와
 * 4가지 스타일(primary, secondary, tertiary, ghost)을 조합하여 사용할 수 있습니다.
 * 텍스트 버튼과 아이콘 전용 버튼 모드를 지원합니다.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      buttonStyle,
      size,
      target,
      buttonType = "default",
      leadIcon,
      tailIcon,
      badge,
      asChild = false,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";

    // Icon-only button
    if (buttonType === "icon") {
      return (
        <Comp
          data-slot="button"
          className={cn(
            buttonVariants({ buttonStyle, size, target, buttonType }),
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    // Default button with text
    return (
      <Comp
        data-slot="button"
        className={cn(
          buttonVariants({ buttonStyle, size, target, buttonType }),
          className
        )}
        ref={ref}
        {...props}
      >
        {leadIcon && <span className="shrink-0">{leadIcon}</span>}
        {children}
        {badge && <span className="shrink-0">{badge}</span>}
        {tailIcon && <span className="shrink-0">{tailIcon}</span>}
      </Comp>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };