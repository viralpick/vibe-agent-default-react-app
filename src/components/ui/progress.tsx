"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/commerce-sdk";

// --- Progress Context ---

interface ProgressContextValue {
  value: number;
  max: number;
}

const ProgressContext = React.createContext<ProgressContextValue | null>(null);

function useProgressContext() {
  const context = React.useContext(ProgressContext);
  if (!context) {
    throw new Error("Progress components must be used within a Progress.Root");
  }
  return context;
}

// --- Variants ---

const barVariants = cva("relative w-full overflow-hidden bg-background-track", {
  variants: {
    variant: {
      default: "",
      stripped: "",
    },
    size: {
      sm: "h-1",
      md: "h-2",
      lg: "h-3",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "sm",
  },
});

const circleVariants = cva("relative inline-flex items-center justify-center", {
  variants: {
    size: {
      sm: "h-8 w-8",
      md: "h-17 w-17",
      lg: "h-20 w-20",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

// --- Components ---

/**
 * Progress 컴포넌트의 루트 컨테이너입니다.
 * 상태(value, max)를 관리하고 하위 컴포넌트에 전달합니다.
 */
function ProgressRoot({
  value = 0,
  max = 100,
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressContext.Provider value={{ value: value ?? 0, max }}>
      <ProgressPrimitive.Root
        data-slot="progress-root"
        value={value}
        max={max}
        className={cn("flex flex-col gap-2 w-full", className)}
        {...props}
      >
        {children}
      </ProgressPrimitive.Root>
    </ProgressContext.Provider>
  );
}

interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof barVariants> {
  indicatorClassName?: string;
}

/**
 * 수평 막대 형태의 프로그레스 바입니다.
 */
function ProgressBar({
  className,
  variant,
  size,
  indicatorClassName,
  ...props
}: ProgressBarProps) {
  const { value, max } = useProgressContext();
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      data-slot="progress-bar-track"
      className={cn(barVariants({ variant, size }), "rounded-round", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-bar-indicator"
        className={cn(
          "relative h-full w-full flex-1 bg-gray-700 transition-all ease-in-out duration-300",
          variant === "stripped" &&
            "before:absolute before:inset-0 before:z-1 before:bg-[linear-gradient(-45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] before:bg-[length:1rem_1rem]",
          indicatorClassName
        )}
        style={{ transform: `translateX(-${100 - percentage}%)` }}
      />
    </div>
  );
}

interface ProgressCircleProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof circleVariants> {
  indicatorClassName?: string;
}

/**
 * 원형 형태의 프로그레스 표시기입니다.
 */
function ProgressCircle({
  className,
  size = "md",
  indicatorClassName,
  ...props
}: ProgressCircleProps) {
  const { value, max } = useProgressContext();
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  // SVG Circle calculations
  const dimensionMap = { sm: 32, md: 68, lg: 80 };
  const d = dimensionMap[size || "md"];
  const strokeWidth = size === "sm" ? 3 : 6;
  const radius = (d - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div
      data-slot="progress-circle"
      className={cn(circleVariants({ size }), className)}
      {...props}
    >
      <svg className="transform -rotate-90" width={d} height={d}>
        {/* Background Circle */}
        <circle
          className="text-gray-300"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={d / 2}
          cy={d / 2}
        />
        {/* Progress Arc */}
        <circle
          className={cn(
            "text-gray-700 transition-all duration-300 ease-in-out",
            indicatorClassName
          )}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={d / 2}
          cy={d / 2}
        />
      </svg>
      {/* Content in the middle (optional, can be extended) */}
    </div>
  );
}

/**
 * 프로그레스 상단 레이아웃 (레이블, 도움말, 값)
 */
function ProgressHeader({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center justify-between w-full", className)}>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

/**
 * 프로그레스 하단 레이아웃 (캡션, 아이콘)
 */
function ProgressFooter({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center gap-1 w-full mt-1", className)}>
      {children}
    </div>
  );
}

/**
 * 프로그레스 레이블
 */
function ProgressLabel({
  className,
  children,
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("text-label-l font-medium text-text-primary", className)}>
      {children}
    </span>
  );
}

/**
 * 프로그레스 도움말 텍스트
 */
function ProgressHelpText({
  className,
  children,
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("text-body-s text-text-secondary", className)}>
      {children}
    </span>
  );
}

/**
 * 프로그레스 현재 값 표시 (퍼센트 등)
 */
function ProgressValue({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  const { value, max } = useProgressContext();
  const percentage = Math.round((value / max) * 100);

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 py-1 bg-background-100 rounded-small text-label-l font-bold text-text-primary",
        className
      )}
    >
      {children || `${percentage}%`}
    </div>
  );
}

/**
 * 프로그레스 하단 캡션
 */
function ProgressCaption({
  className,
  children,
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("text-body-s text-text-secondary", className)}>
      {children}
    </span>
  );
}

/**
 * 프로그레스 스피너 (로딩 표시)
 */
function ProgressSpinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin text-icon-secondary", className)} />;
}

// --- Export ---

const Progress = Object.assign(ProgressRoot, {
  Bar: ProgressBar,
  Circle: ProgressCircle,
  Header: ProgressHeader,
  Footer: ProgressFooter,
  Label: ProgressLabel,
  HelpText: ProgressHelpText,
  Value: ProgressValue,
  Caption: ProgressCaption,
  Spinner: ProgressSpinner,
});

export { Progress };
