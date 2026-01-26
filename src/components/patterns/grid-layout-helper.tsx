import { cn } from "@/lib/commerce-sdk";

/**
 * @component Grid
 * @description A responsive grid layout helper component for arranging child elements
 * in equal-width columns. Uses CSS Grid with customizable columns and gap.
 *
 * @dataStructure
 * - cols: number - Number of grid columns (required, default: 2)
 * - gap: number - Gap between items in design tokens (required, default: 16)
 *   - Maps to Tailwind gap classes (gap-8, gap-16, gap-24, etc.)
 * - children: ReactNode - Child elements to arrange (required)
 * - className?: string - Additional CSS classes
 *
 * @designTokens
 * - Uses spacing tokens: gap-8 (8px), gap-16 (16px), gap-24 (24px), etc.
 * - Columns use minmax(0, 1fr) for equal distribution
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
 * <Grid cols={4} gap={16}>
 *   <StatCard title="Revenue" value="$100K" />
 *   <StatCard title="Orders" value="1,234" />
 *   <StatCard title="Users" value="5,678" />
 *   <StatCard title="Growth" value="+12%" />
 * </Grid>
 *
 * // 2-column grid for charts
 * <Grid cols={2} gap={24}>
 *   <DynamicLineChart {...} />
 *   <DynamicBarChart {...} />
 * </Grid>
 * ```
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