import { cn } from "@/lib/commerce-sdk";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

/**
 * 통계 카드 (Trend 표시 포함)
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
