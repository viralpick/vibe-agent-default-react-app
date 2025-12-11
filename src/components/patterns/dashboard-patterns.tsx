import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/commerce-sdk";

/**
 * Standard Page Header
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full flex items-center justify-between mb-24">
      <div className="flex flex-col gap-6">
        <div className="flex gap-8 items-center">
          {Icon && <Icon className="size-24 text-icon-primary" />}
          <h1
            className="text-h3 font-bold text-text-primary"
            data-editable="true"
            data-element-id="page-title"
          >
            {title}
          </h1>
        </div>
        {description && (
          <p className="text-text-secondary text-body-m">{description}</p>
        )}
      </div>
      {children && <div className="flex gap-8">{children}</div>}
    </div>
  );
}

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

/**
 * Chart Container (Title + Layout)
 */
export function ChartCard({
  title,
  children,
  isLoading,
  action,
}: {
  title: string;
  children: React.ReactNode;
  isLoading: boolean;
  action: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col rounded-xlarge border border-gray-200 bg-gray-0 h-[400px]">
      <CardHeader className="px-24 py-20 border-b border-gray-100 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="font-semibold text-t1 text-text-primary">
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="p-24 flex-1 min-h-0 relative">
        {isLoading ? <Skeleton className="w-full h-full" /> : children}
      </CardContent>
    </Card>
  );
}

/**
 * Main Layout Helper
 */
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 min-w-0 h-full bg-gray-0 p-32 flex flex-col gap-24 overflow-auto">
      {children}
    </main>
  );
}

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
