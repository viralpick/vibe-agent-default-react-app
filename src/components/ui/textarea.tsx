/**
 * @component Textarea
 * @description Multi-line text input with auto-sizing.
 *
 * @designTokens rounded-medium, px-3, py-2, text-label-l
 * @useCase Comments, descriptions, long-form input, notes
 */
import * as React from "react";

import { cn } from "@/lib/commerce-sdk";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-4 w-full rounded-medium border bg-transparent px-3 py-2 text-label-l shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
