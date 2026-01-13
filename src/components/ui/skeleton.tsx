/**
 * @component Skeleton
 * @description Placeholder loading animation for content.
 * Apply custom width/height via className.
 *
 * @useCase Loading states, content placeholders, lazy loading
 */
import { cn } from "@/lib/commerce-sdk";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
