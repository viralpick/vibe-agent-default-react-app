"use client";

import React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn, getColorClass } from "@/lib/commerce-sdk";

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
