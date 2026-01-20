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

export interface DotProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    VariantProps<typeof dotVariants> {}

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
