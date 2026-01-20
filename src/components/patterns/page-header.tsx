/**
 * @component PageHeader
 * @description Standard page header with title, description, icon, and action buttons.
 * Provides consistent top-of-page navigation and context.
 * Supports edit mode with data-editable attributes for in-place text editing.
 *
 * @dataStructure
 * - title: string - Page title text (required)
 * - description: string - Subtitle/description text (required)
 * - icon: React.ElementType - Lucide icon component (required)
 * - children: ReactNode - Action buttons/elements on the right side (required)
 * - editableId?: string - Unique identifier for edit mode (optional, default: "page-title")
 * - editableFilePath?: string - File path for edit mode (optional, default: "src/App.tsx")
 *
 * @designTokens
 * - Uses text-h3 (24px) for title with font-bold
 * - Uses text-body-m (16px) for description
 * - Uses text-text-primary for title, text-text-secondary for description
 * - Uses text-icon-primary for icon
 * - Uses size-24 (24px) for icon size
 * - Uses gap-8 between action buttons
 * - Uses mb-24 for bottom margin
 *
 * @useCase
 * - Top of dashboard pages
 * - Section headers with actions
 * - Any page requiring title + description + actions layout
 *
 * @example
 * ```tsx
 * <PageHeader
 *   title="Sales Dashboard"
 *   description="Monitor your sales performance"
 *   icon={BarChart3}
 *   editableId="main-dashboard-title"
 * >
 *   <Button variant="outline" size="sm">
 *     <Settings className="size-4" />
 *     Settings
 *   </Button>
 *   <Button size="sm">
 *     <Plus className="size-4" />
 *     New Report
 *   </Button>
 * </PageHeader>
 * ```
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  children,
  editableId,
  editableFilePath = "src/App.tsx",
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
  editableId?: string;
  editableFilePath?: string;
}) {
  return (
    <div className="w-full flex items-center justify-between mb-24">
      <div className="flex flex-col gap-6">
        <div className="flex gap-8 items-center">
          {Icon && <Icon className="size-24 text-icon-primary" />}
          <h1
            className="text-h3 font-bold text-text-primary"
            data-editable="true"
            data-element-id={editableId || "page-title"}
            data-file-path={editableFilePath}
            data-prop="title"
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
