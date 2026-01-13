import { cn } from "@/lib/commerce-sdk";

/**
 * Grid Layout Helper
 */
export function Grid({
  cols = 2,
  gap = 16,
  children,
  className,
}: {
  cols: number;
  gap: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(`grid gap-${gap}`, className)}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}
