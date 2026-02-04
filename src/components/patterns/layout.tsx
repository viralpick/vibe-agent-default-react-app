/**
 * @component Layout
 * @description Root layout wrapper for page content. Provides consistent padding,
 * background color, and flex column structure for page sections.
 *
 * @dataStructure
 * - children: ReactNode - Page content to render (required)
 *
 * @designTokens
 * - Uses bg-gray-0 (#ffffff) for background
 * - Uses p-8 (32px) for padding
 * - Uses gap-6 (24px) between child elements
 * - Uses flex-1 and min-w-0 for flexible sizing
 * - overflow-auto for scrollable content
 *
 * @useCase
 * - Wrapping entire page content
 * - Main content area in dashboard layouts
 * - Any full-height scrollable content container
 *
 * @example
 * ```tsx
 * <Layout>
 *   <PageHeader title="Dashboard" description="Overview" icon={LayoutDashboard} />
 *   <Grid cols={4} gap={16}>
 *     <StatCard ... />
 *   </Grid>
 *   <DynamicDataTable ... />
 * </Layout>
 * ```
 */
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 min-w-0 h-full bg-gray-0 p-8 flex flex-col gap-6 overflow-auto">
      {children}
    </main>
  );
}
