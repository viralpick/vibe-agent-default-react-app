/**
 * @fileoverview Pattern Components - High-level, data-driven UI patterns
 * These components are designed for LLM view generation and accept structured data.
 *
 * @module patterns
 *
 * ## Component Selection Guide
 *
 * ### Charts & Data Visualization
 * - DynamicLineChart: Time-series trends, multi-series comparison
 * - DynamicAreaChart: Cumulative values, filled trends
 * - DynamicBarChart: Category comparison, rankings (vertical/horizontal)
 * - DynamicPieChart: Pie/donut charts for proportions, distributions
 * - DynamicComposedChart: Mixed chart types, dual Y-axes
 * - ChartCard: Container wrapper for any chart with title/actions
 *
 * ### Data Tables
 * - DynamicDataTable: Auto-formatted table with column type definitions
 *
 * ### Statistics & Metrics
 * - StatCard: Single KPI with trend indicator
 * - StatusCard: Flexible metric display (progress, rating, MoM/WoW/DoD)
 * - CommentCard: Status-based feedback message (good/bad/neutral)
 *
 * ### Layout & Structure
 * - Layout: Page content wrapper with padding/scrolling
 * - PageHeader: Page title + description + actions
 * - Grid: Responsive column grid layout
 * - ViewTabs: Tab-based content switching
 *
 * ### Date & Time
 * - DatePeriodSelector: Date period picker with presets, monthly, and range selection
 */

/** CommentCard - Status-based feedback message with icons */
export { default as CommentCard } from "./comment-card";

/** ChartCard - Container for chart components with title and actions */
export * from "./chart-card";

/** EditableText - Wrapper for editable text content */
export * from "./editable-text";

/** DynamicCharts - Line, Area, Bar, Pie, Composed chart components */
export * from "./dynamic-chart";

/** DynamicDataTable - Auto-formatted data table with column types */
export * from "./dynamic-data-table";

/** Layout - Page content wrapper */
export * from "./layout";

/** Grid - Responsive grid layout helper */
export * from "./grid-layout-helper";

/** PageHeader - Page title, description, and actions */
export * from "./page-header";

/** StatCard - KPI metric with trend indicator */
export * from "./stat-card";

/** StatusCard - Flexible metric display (progress, rating, metrics) */
export { default as StatusCard } from "./status-card";

/** ViewTabs - Tab-based view switching */
export * from "./view-tabs";

/** DatePeriodSelector - Date period picker with presets, monthly, and range selection */
export * from "./date-period-selector";