import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

/**
 * @component ChartCard
 * @description A container card for wrapping chart components with title, action buttons, and loading state.
 * Provides consistent styling and layout for chart visualizations.
 * Supports edit mode with data-editable attributes for in-place text editing.
 *
 * @dataStructure
 * - title: string - Card header title (required)
 * - children: ReactNode - Chart component to render inside (required)
 * - isLoading?: boolean - Shows skeleton loader when true (optional, default: false)
 * - action?: ReactNode - Action buttons/elements in header (optional)
 * - editableId?: string - Unique identifier for edit mode (optional)
 * - editableFilePath?: string - File path for edit mode (optional, default: "src/App.tsx")
 * - editableLineNumber?: string - Line number in source file for edit mode (optional)
 *
 * @designTokens
 * - Uses rounded-xlarge (12px) for card border radius
 * - Uses border-gray-200, bg-gray-0 for card styling
 * - Uses text-t1 for title typography
 * - Uses px-24, py-20 for header padding
 * - Fixed height of 400px
 *
 * @useCase
 * - Wrapping DynamicLineChart, DynamicBarChart, etc.
 * - Dashboard chart sections with download/filter actions
 * - Any data visualization requiring a titled container
 *
 * @example
 * ```tsx
 * <ChartCard
 *   title="Monthly Revenue"
 *   isLoading={false}
 *   action={<Button variant="ghost" size="sm"><Download /></Button>}
 *   editableId="monthly-revenue-chart"
 *   editableLineNumber="75"
 * >
 *   <DynamicLineChart data={data} config={config} xAxisKey="month" />
 * </ChartCard>
 * ```
 */
export function ChartCard({
  title,
  children,
  isLoading = false,
  action,
  editableId,
  editableFilePath = "src/App.tsx",
  editableLineNumber,
}: {
  title: string;
  children: React.ReactNode;
  isLoading?: boolean;
  action?: React.ReactNode;
  editableId?: string;
  editableFilePath?: string;
  editableLineNumber?: string;
}) {
  const elementId =
    editableId || `chart-${title.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <Card className="flex flex-col rounded-xlarge border border-gray-200 bg-gray-0 h-[400px]">
      <CardHeader className="px-24 py-20 border-b border-gray-100 flex flex-row items-center justify-between space-y-0">
        <CardTitle
          className="font-semibold text-t1 text-text-primary"
          data-editable="true"
          data-element-id={elementId}
          data-file-path={editableFilePath}
          data-line-number={editableLineNumber}
          data-prop="title"
        >
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="flex-1 min-h-0 relative">
        {isLoading ? <Skeleton className="w-full h-full" /> : children}
      </CardContent>
    </Card>
  );
}
