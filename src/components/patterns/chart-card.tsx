import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@enhans/synapse";

/**
 * @component ChartCard
 * @description A container card for wrapping chart components with title, action buttons, and loading state.
 * Provides consistent styling and layout for chart visualizations.
 * Supports edit mode when title is wrapped with EditableText component.
 *
 * @dataStructure
 * - title: string | React.ReactNode - Card header title or EditableText component (required)
 * - children: ReactNode - Chart component to render inside (required)
 * - isLoading?: boolean - Shows skeleton loader when true (optional, default: false)
 * - action?: ReactNode - Action buttons/elements in header (optional)
 *
 * @designTokens
 * - Uses rounded-xlarge (12px) for card border radius
 * - Uses border-gray-200, bg-gray-0 for card styling
 * - Uses text-t1 for title typography
 * - Uses px-6, py-5 for header padding
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
 *   title={
 *     <EditableText data-editable="true" data-line-number="75">
 *       Monthly Revenue
 *     </EditableText>
 *   }
 *   isLoading={false}
 *   action={<Button variant="ghost" size="sm"><Download /></Button>}
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
}: {
  title: string | React.ReactNode;
  children: React.ReactNode;
  isLoading?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col rounded-xlarge border border-gray-200 bg-gray-0 h-[400px]">
      <CardHeader className="px-6 py-5 border-b border-gray-100 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="font-semibold text-t1 text-text-primary">
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
