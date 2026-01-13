import { cn } from "@/lib/commerce-sdk";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

/**
 * @component StatCard
 * @description Displays a single KPI metric with trend indicator. Used for dashboard
 * summary statistics showing current values and period-over-period changes.
 *
 * @dataStructure
 * - title: string - Metric label (required)
 * - value: string - Formatted display value, e.g., "₩125,430,000" or "1,234명" (required)
 * - trend: number - Trend direction and magnitude (required)
 *   - Positive: green color, shows "+"
 *   - Negative: red color
 *   - Zero: neutral gray color
 * - trendValue: string - Formatted trend display, e.g., "12.5%" or "-3.1%" (required)
 * - isLoading: boolean - Shows skeleton when true (required)
 * - icon: React.ElementType - Lucide icon component for the metric (required)
 *
 * @designTokens
 * - Uses rounded-large (8px) for card border radius
 * - Uses bg-gray-0 for background
 * - Uses text-h3 (24px) for value display
 * - Uses text-label-l (14px) for title
 * - Uses text-body-xs (12px) for trend text
 * - Uses text-green-700 for positive trend, text-red-500 for negative
 * - Uses size-16 (16px) for icon
 *
 * @useCase
 * - Dashboard KPI summary row
 * - Revenue/sales metrics display
 * - User count statistics
 * - Performance indicators with trends
 *
 * @example
 * ```tsx
 * <StatCard
 *   title="Total Revenue"
 *   value="₩125,430,000"
 *   trend={12.5}
 *   trendValue="12.5%"
 *   isLoading={false}
 *   icon={BarChart3}
 * />
 * ```
 */
export function StatCard({
  title,
  value,
  trend,
  trendValue,
  isLoading,
  icon: Icon,
}: {
  title: string;
  value: string;
  trend: number;
  trendValue: string;
  isLoading: boolean;
  icon: React.ElementType;
}) {
  if (isLoading)
    return <Skeleton className="h-[120px] w-full rounded-xlarge" />;

  return (
    <Card className="rounded-large border-border-200 bg-gray-0 h-full">
      <CardHeader className="flex flex-row items-center justify-between px-20 py-16 pb-8 space-y-0">
        <CardTitle className="text-label-l font-medium text-text-secondary">
          {title}
        </CardTitle>
        {Icon && <Icon className="size-16 text-icon-secondary" />}
      </CardHeader>
      <CardContent className="px-20 py-16 pt-0 flex flex-col gap-4">
        <div className="text-h3 font-bold text-text-primary">{value}</div>
        {(trend || trendValue) && (
          <p
            className={cn(
              "text-body-xs flex items-center gap-4",
              trend > 0
                ? "text-green-700"
                : trend < 0
                ? "text-red-500"
                : "text-text-secondary"
            )}
          >
            {trend > 0 ? "+" : ""}
            {trendValue}
            <span className="text-text-secondary opacity-70 ml-4">
              지난 기간 대비
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
