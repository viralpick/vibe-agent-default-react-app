import { cn } from "@/lib/commerce-sdk";

/**
 * @component Grid
 * @description A responsive grid layout helper component for arranging child elements
 * in equal-width columns. Uses CSS Grid with container queries for responsive behavior
 * inside iframes. Automatically collapses columns on narrow containers.
 *
 * @dataStructure
 * - cols: number - Number of grid columns (required, default: 2)
 * - gap: number - Gap between items in Tailwind spacing units (required, default: 4)
 *   - Maps to Tailwind gap classes (gap-2 = 8px, gap-4 = 16px, gap-6 = 24px, etc.)
 * - children: ReactNode - Child elements to arrange (required)
 * - className?: string - Additional CSS classes
 *
 * @designTokens
 * - Uses spacing tokens: gap-2 (8px), gap-4 (16px), gap-6 (24px), etc.
 * - Columns use minmax(0, 1fr) for equal distribution
 * - Container query breakpoints: 480px (2-col), 768px (3-col), 1024px (4-col)
 *
 * @useCase
 * - Dashboard card layouts (2-4 columns of StatCards)
 * - Form field arrangements
 * - Chart grid layouts
 * - Any equal-width column layout needs
 *
 * @example
 * ```tsx
 * // 4-column grid for stat cards
 * <Grid cols={4} gap={4}>
 *   <StatCard title="Revenue" value="$100K" />
 *   <StatCard title="Orders" value="1,234" />
 *   <StatCard title="Users" value="5,678" />
 *   <StatCard title="Growth" value="+12%" />
 * </Grid>
 *
 * // 2-column grid for charts
 * <Grid cols={2} gap={6}>
 *   <DynamicLineChart {...} />
 *   <DynamicBarChart {...} />
 * </Grid>
 * ```
 */

function getResponsiveGridStyle(cols: number): Record<string, string> {
  if (cols <= 1) return {};
  // CSS container query based responsive grid
  // Fallback to 1 column, then scale up at container breakpoints
  const breakpoints: Record<string, string> = {};
  if (cols >= 2) breakpoints["--grid-cols-sm"] = "2";
  if (cols >= 3) breakpoints["--grid-cols-md"] = String(Math.min(cols, 3));
  if (cols >= 4) breakpoints["--grid-cols-lg"] = String(cols);
  return breakpoints;
}

export function Grid({
  cols = 2,
  gap = 4,
  children,
  className,
}: {
  cols: number;
  gap: number;
  children: React.ReactNode;
  className?: string;
}) {
  if (cols <= 1) {
    return (
      <div className={cn(`grid grid-cols-1 gap-${gap}`, className)}>
        {children}
      </div>
    );
  }

  // Use CSS custom properties for container-query based responsive columns
  const cssVars = getResponsiveGridStyle(cols);

  return (
    <div
      className={cn("@container", className)}
      style={cssVars as React.CSSProperties}
    >
      <div
        className={cn(
          `grid gap-${gap}`,
          "grid-cols-1",
          cols >= 2 && "@min-[480px]:grid-cols-2",
          cols >= 3 && "@min-[768px]:grid-cols-3",
          cols >= 4 && "@min-[1024px]:grid-cols-4",
        )}
      >
        {children}
      </div>
    </div>
  );
}
