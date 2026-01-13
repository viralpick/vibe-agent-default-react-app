import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

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
