"use client";

/**
 * @component Tooltip
 * @description Hover-triggered informational popup. Built on Radix UI Tooltip.
 * Composed of Tooltip, TooltipTrigger, TooltipContent, TooltipProvider.
 *
 * @useCase Help text, abbreviation explanations, icon labels
 */
import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/commerce-sdk";

const tooltipVariants = cva(
  "z-50 overflow-visible bg-background-0 text-label-3 border border-border-100 drop-shadow-[0_4px_12px_rgba(0,0,0,0.08)] animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
  {
    variants: {
      size: {
        lg: "p-3 rounded-large",
        md: "px-2 py-1 h-8 flex items-center rounded-large",
        sm: "px-2 py-1 h-6 flex items-center rounded-[2px]",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

/**
 * Tooltip 컴포넌트의 화살표 위치 및 정렬 기준
 */
export type TipPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "right-center"
  | "left-center";

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>): React.JSX.Element {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>): React.JSX.Element {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  );
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>): React.JSX.Element {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

/**
 * TooltipContent 컴포넌트 Props
 *
 * @property {boolean} tip - 말꼬리(화살표) 표시 여부
 * @property {"lg" | "md" | "sm"} size - 툴팁 크기
 * @property {TipPosition} tipPosition - 툴팁 노출 위치 및 화살표 정렬 (자동 side/align 매핑)
 */
export interface TooltipContentProps
  extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>,
    VariantProps<typeof tooltipVariants> {
  tip?: boolean;
  tipPosition?: TipPosition;
}

const posMap: Record<
  TipPosition,
  { side: "top" | "bottom" | "left" | "right"; align: "start" | "center" | "end" }
> = {
  "top-left": { side: "top", align: "start" },
  "top-center": { side: "top", align: "center" },
  "top-right": { side: "top", align: "end" },
  "bottom-left": { side: "bottom", align: "start" },
  "bottom-center": { side: "bottom", align: "center" },
  "bottom-right": { side: "bottom", align: "end" },
  "right-center": { side: "right", align: "center" },
  "left-center": { side: "left", align: "center" },
};

/**
 * 호버 시 나타나는 정보를 담는 Tooltip 컨텐츠 컴포넌트
 *
 * @example
 * ```tsx
 * <Tooltip>
 *   <TooltipTrigger>Hover me</TooltipTrigger>
 *   <TooltipContent tip size="md" tipPosition="top-center">
 *     Tooltip text
 *   </TooltipContent>
 * </Tooltip>
 * ```
 */
function TooltipContent({
  className,
  sideOffset = 6,
  children,
  tip = false,
  size,
  tipPosition = "top-center",
  side,
  align,
  ...props
}: TooltipContentProps): React.JSX.Element {
  const mappedPos = posMap[tipPosition];

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        side={side ?? mappedPos.side}
        align={align ?? mappedPos.align}
        sideOffset={sideOffset}
        className={cn(tooltipVariants({ size }), className)}
        {...props}
      >
        <div className="relative z-10">{children}</div>
        {tip && (
          <TooltipPrimitive.Arrow asChild className="z-20">
            <svg
              width="12"
              height="6"
              viewBox="0 0 12 6"
              className="drop-shadow-[0_1px_0_rgba(0,0,0,0.05)]"
            >
              <path
                d="M0 0 L6 6 L12 0"
                className="fill-background-0 stroke-border-100 stroke-[1px]"
              />
            </svg>
          </TooltipPrimitive.Arrow>
        )}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
