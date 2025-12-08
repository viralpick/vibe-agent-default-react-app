import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-[var(--foreground)] placeholder:text-text-secondary selection:bg-[var(--primary)] selection:text-[var(--primary-foreground)] border-[var(--input)] h-[36px] w-full min-w-0 rounded-medium border bg-gray-0 px-12 py-4 text-label-l shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-[28px] file:border-0 file:bg-transparent file:text-label-l file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-[var(--ring)] focus-visible:ring-[var(--ring)/50] focus-visible:ring-[1px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
