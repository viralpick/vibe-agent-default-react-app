import React from "react";

/**
 * @component EditableText
 * @description A wrapper component for editable text content that supports
 * in-place editing via data attributes. The text inside this component
 * can be modified through the edit mode system.
 *
 * @dataStructure
 * - children: React.ReactNode - The text content to display (required)
 * - data-editable: string - Must be "true" to enable editing (required for edit mode)
 * - data-line-number: string - Line number in source file for edit matching (required for edit mode)
 * - className: string - Additional CSS classes (optional)
 *
 * @useCase
 * - Wrapping editable titles in PageHeader, StatCard, Charts, etc.
 * - Any text that should be editable through the edit mode system
 *
 * @example
 * ```tsx
 * <PageHeader
 *   title={
 *     <EditableText data-editable="true" data-line-number="52">
 *       Sales Dashboard
 *     </EditableText>
 *   }
 *   description="Monitor your sales performance"
 *   icon={BarChart3}
 * >
 *   <DatePeriodSelector value={period} onChange={setPeriod} />
 * </PageHeader>
 * ```
 */

interface EditableTextProps {
  children: React.ReactNode;
  "data-editable"?: string;
  "data-line-number"?: string;
  className?: string;
}

export const EditableText: React.FC<EditableTextProps> = ({
  children,
  className,
  ...props
}) => (
  <span className={className} {...props}>
    {children}
  </span>
);
