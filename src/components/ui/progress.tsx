"use client";

import React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn, getColorClass } from "@/lib/commerce-sdk";

/**
 * @component Progress
 * @description A horizontal progress bar indicator built on Radix UI Progress.
 * Supports custom indicator colors via hex, rgb, hsl, or Tailwind class names.
 *
 * @dataStructure
 * - value?: number - Progress percentage 0-100 (optional)
 * - indicatorColor?: string - Indicator color (optional)
 *   - Hex: "#22c55e"
 *   - RGB: "rgb(34, 197, 94)"
 *   - HSL: "hsl(142, 71%, 45%)"
 *   - Tailwind: "bg-green-500"
 * - className?: string - Additional CSS classes for track
 *
 * @designTokens
 * - Uses h-2 (8px) for default height
 * - Uses rounded-full for pill shape
 * - Uses bg-primary/20 for track background
 * - Uses bg-primary for default indicator
 *
 * @useCase
 * - Goal completion tracking
 * - File upload progress
 * - Loading indicators
 * - Skill/rating bars
 *
 * @example
 * ```tsx
 * <Progress value={75} />
 * <Progress value={50} indicatorColor="#8b5cf6" />
 * <Progress value={90} indicatorColor="bg-green-500" />
 * ```
 */
function Progress({
  className,
  indicatorColor,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorColor?: string;
}): React.JSX.Element {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "bg-primary h-full w-full flex-1 transition-all",
          indicatorColor && getColorClass(indicatorColor)
        )}
        style={{
          transform: `translateX(-${100 - (value || 0)}%)`,
          ...(indicatorColor?.startsWith("#") ||
          indicatorColor?.startsWith("rgb") ||
          indicatorColor?.startsWith("hsl")
            ? { backgroundColor: indicatorColor }
            : {}),
        }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
