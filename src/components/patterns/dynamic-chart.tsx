"use client";

/**
 * @fileoverview Dynamic Chart Components for data visualization.
 * Provides Line, Area, Bar, and Composed chart types with consistent styling.
 *
 * @module patterns/dynamic-chart
 */

import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";

import { cn } from "@/lib/commerce-sdk";

import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

import { Skeleton } from "@/components/ui/skeleton";

const DEFAULT_CHART_HEIGHT = 300;

type SeriesType = "line" | "bar" | "area";
type YAxisSide = "left" | "right";

/**
 * Configuration for a series in ComposedChart
 * @property label - Display label for legend
 * @property color - Hex color code for the series
 * @property type - Chart type: "line" | "bar" | "area"
 * @property yAxisId - Which Y axis to use: "left" | "right"
 * @property stackId - Stack identifier for stacked charts
 */
type ComposedSeriesConfig = {
  label: string;
  color: string;
  type?: SeriesType;
  yAxisId?: YAxisSide;
  stackId?: string;
};

/**
 * Base props shared by all dynamic chart components
 */
type ChartSeriesConfig = Record<
  string,
  {
    label: string;
    color: string;
  }
>;

export type BaseDynamicChartProps = {
  title?: string;
  description?: string;
  height?: number;
  fullWidth?: boolean;
  xAxisKey: string;
  yAxisKey?: string;
  data: Record<string, unknown>[];
  /** Series configuration - defines data keys and their labels/colors */
  config?: ChartSeriesConfig;
  /** Alias for config - use either config or series */
  series?: ChartSeriesConfig;
  tooltipIndicator?: "dot" | "line" | "dashed" | false;
  showLegend?: boolean;
  tickFormatter?: (value: string) => string;
};

export type DynamicAreaChartProps = BaseDynamicChartProps & {
  variant?: "monotone" | "linear" | "natural" | "step";
};

/**
 * @component DynamicAreaChart
 * @description Renders time-series or categorical data as a filled area chart.
 * Suitable for showing cumulative values, trends over time, or comparing totals.
 *
 * @dataStructure
 * - data: Record<string, unknown>[] - Array of data points (required)
 *   - Each object must contain xAxisKey field and all keys defined in config
 * - config: { [seriesKey]: { label: string, color: string } } - Series configuration (required)
 * - xAxisKey: string - Field name for X axis values (required)
 * - yAxisKey?: string - Field name for Y axis values (optional)
 * - title?: string - Chart title (optional)
 * - description?: string - Chart description (optional)
 * - height?: number - Chart height in pixels (optional)
 * - variant?: "monotone" | "linear" | "natural" | "step" - Line interpolation (optional, default: "monotone")
 * - showLegend?: boolean - Show/hide legend (optional, default: true)
 *
 * @useCase
 * - Revenue accumulation over time
 * - User growth trends
 * - Inventory level tracking
 * - Market share visualization
 *
 * @example
 * ```tsx
 * <DynamicAreaChart
 *   title="Monthly Revenue"
 *   xAxisKey="month"
 *   data={[
 *     { month: "Jan", revenue: 4000 },
 *     { month: "Feb", revenue: 3000 },
 *   ]}
 *   config={{
 *     revenue: { label: "Revenue", color: "#8884d8" }
 *   }}
 * />
 * ```
 */
export function DynamicAreaChart({
  title,
  description,
  height = DEFAULT_CHART_HEIGHT,
  xAxisKey,
  yAxisKey,
  data,
  config,
  series,
  variant = "monotone",
  tooltipIndicator = "dot",
  showLegend = true,
  tickFormatter,
}: DynamicAreaChartProps): React.ReactNode {
  const effectiveConfig = series ?? config ?? {};
  const keys = Object.keys(effectiveConfig);
  const chartHeight = height ?? DEFAULT_CHART_HEIGHT;

  return (
    <Card className="gap-6">
      {(title || description) && (
        <CardHeader>
          {title && (
            <CardTitle
              className="w-fit"
              data-editable="title"
              data-prop="title"
            >
              {title}
            </CardTitle>
          )}
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : (
            <CardDescription hidden />
          )}
        </CardHeader>
      )}
      <CardContent>
        <ChartContainer
          config={effectiveConfig}
          className={cn("w-full", `h-[${chartHeight}px]`)}
        >
          <AreaChart
            accessibilityLayer
            data={data ?? []}
            height={height}
            margin={{ top: 0, right: 25, bottom: 0, left: 15 }}
          >
            <CartesianGrid vertical={false} stroke="#ebebeb" />
            <XAxis
              dataKey={xAxisKey}
              tickLine={false}
              axisLine={false}
              tickMargin={5}
              tickFormatter={tickFormatter}
              fontSize={10}
              interval={0}
              dx={10}
              dy={0}
            />
            <YAxis
              dataKey={yAxisKey}
              fontSize={12}
              tickLine={false}
              tickMargin={8}
              axisLine={false}
            />
            {tooltipIndicator !== false && (
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator={tooltipIndicator} />}
              />
            )}
            {showLegend && <Legend content={<ChartLegendContent />} />}
            {keys.map((key) => {
              const color = effectiveConfig[key]?.color || "#000000";
              return (
                <Area
                  key={key}
                  type={variant}
                  dataKey={key}
                  stroke={color}
                  fill={color}
                  fillOpacity={0.4}
                  strokeWidth={2}
                  connectNulls
                  dot={false}
                />
              );
            })}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export type DynamicLineChartProps = BaseDynamicChartProps & {
  variant?: "monotone" | "linear" | "natural" | "step";
};

/**
 * @component DynamicLineChart
 * @description Renders time-series data as a line chart. Best for showing trends,
 * changes over time, or comparing multiple series.
 *
 * @dataStructure
 * - data: Record<string, unknown>[] - Array of data points (required)
 *   - Each object must contain xAxisKey field and all keys defined in config
 * - config: { [seriesKey]: { label: string, color: string } } - Series configuration (required)
 * - xAxisKey: string - Field name for X axis values (required)
 * - yAxisKey?: string - Field name for Y axis values (optional)
 * - title?: string - Chart title (optional)
 * - description?: string - Chart description (optional)
 * - height?: number - Chart height in pixels (optional)
 * - variant?: "monotone" | "linear" | "natural" | "step" - Line interpolation (optional, default: "monotone")
 * - showLegend?: boolean - Show/hide legend (optional, default: true)
 *
 * @useCase
 * - Monthly sales trends
 * - Traffic patterns over time
 * - Performance metrics tracking
 * - Multi-series comparison (e.g., this year vs last year)
 *
 * @example
 * ```tsx
 * <DynamicLineChart
 *   title="Sales Trend"
 *   xAxisKey="month"
 *   data={[
 *     { month: "Jan", sales: 100, target: 120 },
 *     { month: "Feb", sales: 150, target: 130 },
 *   ]}
 *   config={{
 *     sales: { label: "Sales", color: "#8884d8" },
 *     target: { label: "Target", color: "#82ca9d" }
 *   }}
 * />
 * ```
 */
export function DynamicLineChart({
  title,
  description,
  height = DEFAULT_CHART_HEIGHT,
  xAxisKey,
  yAxisKey,
  data,
  config,
  series,
  variant = "monotone",
  tooltipIndicator = "dot",
  showLegend = true,
  tickFormatter,
}: DynamicLineChartProps): React.ReactNode {
  const effectiveConfig = series ?? config ?? {};
  const keys = Object.keys(effectiveConfig);
  const chartHeight = height ?? DEFAULT_CHART_HEIGHT;

  return (
    <Card className="gap-6">
      {(title || description) && (
        <CardHeader>
          {title && (
            <CardTitle
              className="w-fit"
              data-editable="title"
              data-prop="title"
            >
              {title}
            </CardTitle>
          )}
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : (
            <CardDescription hidden />
          )}
        </CardHeader>
      )}
      <CardContent>
        <ChartContainer
          config={effectiveConfig}
          className={cn("w-full", `h-[${chartHeight}px]`)}
        >
          <LineChart
            accessibilityLayer
            data={data ?? []}
            height={height}
            margin={{ top: 0, right: 25, bottom: 0, left: 15 }}
          >
            <CartesianGrid vertical={false} stroke="#ebebeb" />
            <XAxis
              dataKey={xAxisKey}
              tickLine={false}
              axisLine={false}
              tickMargin={5}
              tickFormatter={tickFormatter}
              fontSize={10}
              interval={0}
              dx={10}
              dy={0}
            />
            <YAxis
              dataKey={yAxisKey}
              fontSize={12}
              tickLine={false}
              tickMargin={8}
              axisLine={false}
            />
            {tooltipIndicator !== false && (
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator={tooltipIndicator} />}
              />
            )}
            {showLegend && <Legend content={<ChartLegendContent />} />}
            {keys.map((key) => {
              const color = effectiveConfig[key]?.color || "#000000";
              return (
                <Line
                  key={key}
                  dataKey={key}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  type={variant}
                />
              );
            })}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export type DynamicBarChartProps = BaseDynamicChartProps & {
  layout?: "vertical" | "horizontal";
};

/**
 * @component DynamicBarChart
 * @description Renders categorical data as a bar chart. Supports both vertical
 * and horizontal layouts for different comparison needs.
 *
 * @dataStructure
 * - data: Record<string, unknown>[] - Array of data points (required)
 *   - Each object must contain xAxisKey field and all keys defined in config
 * - config: { [seriesKey]: { label: string, color: string } } - Series configuration (required)
 * - xAxisKey: string - Field name for X axis/category values (required)
 * - yAxisKey?: string - Field name for Y axis values (optional, used in horizontal layout)
 * - layout?: "vertical" | "horizontal" - Bar orientation (optional, default: "vertical")
 * - title?: string - Chart title (optional)
 * - height?: number - Chart height in pixels (optional)
 * - showLegend?: boolean - Show/hide legend (optional, default: true)
 *
 * @useCase
 * - Category comparison (e.g., sales by product)
 * - Ranking visualization (horizontal layout)
 * - Period comparison (e.g., monthly totals)
 * - Distribution display
 *
 * @example
 * ```tsx
 * // Vertical bar chart
 * <DynamicBarChart
 *   title="Sales by Category"
 *   xAxisKey="category"
 *   data={[
 *     { category: "Electronics", sales: 4000 },
 *     { category: "Clothing", sales: 3000 },
 *   ]}
 *   config={{ sales: { label: "Sales", color: "#8884d8" } }}
 * />
 *
 * // Horizontal bar chart (ranking)
 * <DynamicBarChart
 *   layout="horizontal"
 *   xAxisKey="value"
 *   yAxisKey="name"
 *   data={[{ name: "Product A", value: 100 }]}
 *   config={{ value: { label: "Value", color: "#82ca9d" } }}
 * />
 * ```
 */
export function DynamicBarChart({
  title,
  description,
  height = DEFAULT_CHART_HEIGHT,
  xAxisKey,
  yAxisKey,
  data,
  config,
  series,
  layout = "vertical",
  tooltipIndicator = "dot",
  showLegend = true,
  tickFormatter,
  isLoading = false,
  maxVisibleItems,
}: DynamicBarChartProps & { isLoading?: boolean; maxVisibleItems?: number }): React.ReactNode {
  const effectiveConfig = series ?? config ?? {};
  const keys = Object.keys(effectiveConfig);
  const baseHeight = height ?? DEFAULT_CHART_HEIGHT;
  
  // For horizontal layout, calculate height based on data count
  const barHeight = 36; // height per bar item
  const dataCount = Array.isArray(data) ? data.length : 0;
  
  const chartHeight = useMemo(() => {
    if (layout !== "horizontal") return baseHeight;
    // Calculate dynamic height based on data count
    const calculatedHeight = dataCount * barHeight + 40; // 40px for padding
    // Use maxVisibleItems to limit visible area, rest will scroll
    if (maxVisibleItems && dataCount > maxVisibleItems) {
      return maxVisibleItems * barHeight + 40;
    }
    return Math.max(baseHeight, calculatedHeight);
  }, [layout, dataCount, baseHeight, maxVisibleItems]);
  
  // Actual chart height (for scrollable content)
  const actualChartHeight = useMemo(() => {
    if (layout !== "horizontal") return chartHeight;
    return dataCount * barHeight + 40;
  }, [layout, dataCount, chartHeight]);
  
  // Whether scrolling is needed
  const needsScroll = layout === "horizontal" && actualChartHeight > chartHeight;

  const charWidth = 7;
  const minWidth = 60;
  const maxWidth = 200;

  const autoYAxisWidth = useMemo(() => {
    if (layout !== "horizontal" || !yAxisKey) return undefined;
    const maxLen = (Array.isArray(data) ? data : []).reduce((m, d) => {
      const v = String((d as Record<string, unknown>)[yAxisKey] ?? "");
      return Math.max(m, v.length);
    }, 0);
    const est = maxLen * charWidth + 16;
    return Math.min(maxWidth, Math.max(minWidth, est));
  }, [layout, yAxisKey, data]);

  const AutoTick = ({
    x,
    y,
    payload,
  }: {
    x: number;
    y: number;
    payload: { value: unknown };
  }) => {
    const raw = String(payload?.value ?? "");
    const formatted = tickFormatter ? tickFormatter(raw) : raw;
    const maxChars = Math.max(
      1,
      Math.floor(((autoYAxisWidth ?? maxWidth) - 6) / charWidth)
    );
    const text =
      formatted.length > maxChars
        ? formatted.slice(0, Math.max(1, maxChars - 1)) + "…"
        : formatted;
    return (
      <text x={x} y={y} dy={4} textAnchor="end">
        {text}
      </text>
    );
  };

  if (isLoading) {
    return (
      <Card className="gap-6">
        {(title || description) && (
          <CardHeader>
            {title && <CardTitle className="w-fit">{title}</CardTitle>}
            {description ? (
              <CardDescription>{description}</CardDescription>
            ) : (
              <CardDescription hidden />
            )}
          </CardHeader>
        )}
        <CardContent>
          <Skeleton className={cn("w-full", `h-[${chartHeight}px]`)} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-6">
      {(title || description) && (
        <CardHeader>
          {title && (
            <CardTitle
              className="w-fit"
              data-editable="title"
              data-prop="title"
            >
              {title}
            </CardTitle>
          )}
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : (
            <CardDescription hidden />
          )}
        </CardHeader>
      )}
      <CardContent>
        <div
          className={cn(
            "w-full",
            needsScroll && "overflow-y-auto"
          )}
          style={{ height: chartHeight, maxHeight: chartHeight }}
        >
          <ChartContainer
            config={effectiveConfig}
            className="w-full"
            style={{ height: actualChartHeight, minHeight: actualChartHeight }}
          >
            <BarChart
              accessibilityLayer
              data={data ?? []}
              layout={layout === "horizontal" ? "vertical" : undefined}
              height={actualChartHeight}
              margin={
                layout === "horizontal"
                  ? { top: 0, right: 15, bottom: 0, left: 40 }
                  : {
                      top: 0,
                      right: 25,
                      bottom: 0,
                      left: 15,
                    }
              }
            >
              <CartesianGrid
                stroke="#ebebeb"
                strokeDasharray="3 3"
                horizontal={layout === "vertical"}
                vertical={layout === "horizontal"}
              />
              {layout === "vertical" ? (
                <XAxis
                  type="category"
                  dataKey={xAxisKey}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tickFormatter={tickFormatter}
                />
              ) : (
                <XAxis type="number" dataKey={xAxisKey} hide />
              )}
              {layout === "horizontal" ? (
                <YAxis
                  type="category"
                  dataKey={yAxisKey}
                  width={autoYAxisWidth ?? maxWidth}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  // tickFormatter={tickFormatter}
                  tick={<AutoTick x={0} y={0} payload={{ value: "" }} />}
                />
              ) : (
                <YAxis
                  dataKey={yAxisKey}
                  fontSize={12}
                  tickLine={false}
                  tickMargin={8}
                  axisLine={false}
                />
              )}
              {tooltipIndicator !== false && (
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator={tooltipIndicator} />}
                />
              )}
              {showLegend && <Legend content={<ChartLegendContent />} />}
              {keys.map((key) => {
                const color = effectiveConfig[key]?.color || "#000000";
                return (
                  <Bar
                    key={key}
                    dataKey={key}
                    fill={color}
                    maxBarSize={layout === "horizontal" ? 28 : 32}
                    radius={layout === "horizontal" ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                  />
                );
              })}
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export type DynamicComposedChartProps = Omit<
  BaseDynamicChartProps,
  "config" | "series"
> & {
  config?: Record<string, ComposedSeriesConfig>;
  /** Alias for config */
  series?: Record<string, ComposedSeriesConfig>;
  yAxisRightKey?: string;
  variant?: "monotone" | "linear" | "natural" | "step";
  barMaxBarSize?: number;
  areaFillOpacity?: number;
  order?: string[];
};

/**
 * @component DynamicComposedChart
 * @description Combines multiple chart types (line, bar, area) in a single visualization.
 * Supports dual Y-axes for comparing metrics with different scales.
 *
 * @dataStructure
 * - data: Record<string, unknown>[] - Array of data points (required)
 * - config: { [seriesKey]: ComposedSeriesConfig } - Extended series configuration (required)
 *   - label: string - Display label
 *   - color: string - Hex color
 *   - type?: "line" | "bar" | "area" - Chart type for this series
 *   - yAxisId?: "left" | "right" - Which Y axis to use
 *   - stackId?: string - Group identifier for stacking
 * - xAxisKey: string - Field name for X axis values (required)
 * - yAxisKey?: string - Field for left Y axis (optional)
 * - yAxisRightKey?: string - Field for right Y axis (optional)
 * - order?: string[] - Render order of series (optional)
 * - barMaxBarSize?: number - Maximum bar width (optional, default: 28)
 * - areaFillOpacity?: number - Area fill opacity (optional, default: 0.4)
 *
 * @useCase
 * - Revenue (bars) vs Growth Rate (line) on dual axes
 * - Volume (area) with Price (line) overlay
 * - Complex KPI dashboards with multiple metrics
 * - Stacked categories with trend line
 *
 * @example
 * ```tsx
 * <DynamicComposedChart
 *   title="Revenue & Growth"
 *   xAxisKey="month"
 *   data={[
 *     { month: "Jan", revenue: 4000, growth: 5.2 },
 *     { month: "Feb", revenue: 3500, growth: -12.5 },
 *   ]}
 *   config={{
 *     revenue: { label: "Revenue", color: "#8884d8", type: "bar", yAxisId: "left" },
 *     growth: { label: "Growth %", color: "#82ca9d", type: "line", yAxisId: "right" }
 *   }}
 * />
 * ```
 */
export function DynamicComposedChart({
  title,
  description,
  height = 320,
  xAxisKey,
  yAxisKey,
  yAxisRightKey,
  data,
  config,
  series,
  variant = "monotone",
  tooltipIndicator = "dot",
  showLegend = true,
  tickFormatter,
  barMaxBarSize = 28,
  areaFillOpacity = 0.4,
  order,
}: DynamicComposedChartProps): React.ReactNode {
  const effectiveConfig = series ?? config ?? {};
  const keys = order && order.length ? order : Object.keys(effectiveConfig);
  const hasRight = keys.some(
    (k) => (effectiveConfig[k]?.yAxisId ?? "left") === "right"
  );
  const legendConfig = Object.fromEntries(
    Object.entries(effectiveConfig).map(([k, v]) => [
      k,
      { label: v.label, color: v.color },
    ])
  );

  return (
    <Card className="gap-6">
      {(title || description) && (
        <CardHeader>
          {title && (
            <CardTitle
              className="w-fit"
              data-editable="title"
              data-prop="title"
            >
              {title}
            </CardTitle>
          )}
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : (
            <CardDescription hidden />
          )}
        </CardHeader>
      )}
      <CardContent>
        <ChartContainer
          config={legendConfig}
          className={cn("w-full", `h-[${height}px]`)}
        >
          <ComposedChart
            accessibilityLayer
            data={data ?? []}
            height={height}
            margin={{ top: 0, right: 25, bottom: 0, left: 15 }}
          >
            <CartesianGrid vertical={false} stroke="#ebebeb" />
            <XAxis
              dataKey={xAxisKey}
              tickLine={false}
              axisLine={false}
              tickMargin={5}
              tickFormatter={tickFormatter}
              fontSize={10}
              interval={0}
              dx={10}
              dy={0}
            />
            <YAxis
              yAxisId="left"
              dataKey={yAxisKey}
              fontSize={12}
              tickLine={false}
              tickMargin={8}
              axisLine={false}
            />
            {hasRight && (
              <YAxis
                yAxisId="right"
                orientation="right"
                dataKey={yAxisRightKey}
                fontSize={12}
                tickLine={false}
                tickMargin={8}
                axisLine={false}
              />
            )}
            {tooltipIndicator !== false && (
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator={tooltipIndicator} />}
              />
            )}
            {showLegend && <Legend content={<ChartLegendContent />} />}
            {keys.map((key) => {
              const c = effectiveConfig[key];
              if (!c) return null;
              const type: SeriesType = c.type ?? "line";
              const yAxisId: YAxisSide = c.yAxisId ?? "left";
              const color = c.color;
              if (type === "bar") {
                return (
                  <Bar
                    key={key}
                    yAxisId={yAxisId}
                    dataKey={key}
                    fill={color}
                    maxBarSize={barMaxBarSize}
                    radius={[4, 4, 0, 0]}
                    stackId={c.stackId}
                  />
                );
              }
              if (type === "area") {
                return (
                  <Area
                    key={key}
                    yAxisId={yAxisId}
                    type={variant}
                    dataKey={key}
                    stroke={color}
                    fill={color}
                    fillOpacity={areaFillOpacity}
                    strokeWidth={2}
                    connectNulls
                    dot={false}
                    stackId={c.stackId}
                  />
                );
              }
              return (
                <Line
                  key={key}
                  yAxisId={yAxisId}
                  dataKey={key}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  type={variant}
                />
              );
            })}
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Default color palette for pie/donut charts
 */
const PIE_CHART_COLORS = [
  "#3b82f6", // blue-500
  "#22c55e", // green-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
  "#84cc16", // lime-500
  "#ec4899", // pink-500
  "#6366f1", // indigo-500
];

/**
 * Props for DynamicPieChart component
 */
export type DynamicPieChartProps = {
  title?: string;
  description?: string;
  data: { name: string; value: number }[];
  colors?: string[];
  innerRadius?: number;
  outerRadius?: number;
  height?: number;
  showLegend?: boolean;
  showLabel?: boolean;
  isLoading?: boolean;
  /** Optional key normalization function for color mapping */
  normalizeKey?: (key: string) => string;
};

/**
 * @component DynamicPieChart
 * @description Renders data as a pie or donut chart. Use innerRadius > 0 for donut style.
 * Automatically handles color mapping with case-insensitive key normalization.
 *
 * @dataStructure
 * - data: { name: string, value: number }[] - Array of segments (required)
 *   - name: Segment label (e.g., "POSITIVE", "Negative")
 *   - value: Numeric value for segment size
 * - colors?: string[] - Array of hex colors for segments (optional, uses default palette)
 * - innerRadius?: number - Inner radius for donut effect (optional, 0 = pie, >0 = donut)
 * - outerRadius?: number - Outer radius of the chart (optional, default: 100)
 * - height?: number - Chart height in pixels (optional, default: 300)
 * - showLegend?: boolean - Show/hide legend (optional, default: true)
 * - showLabel?: boolean - Show labels on segments (optional, default: false)
 * - isLoading?: boolean - Show skeleton loader (optional, default: false)
 * - normalizeKey?: (key: string) => string - Key normalization for color lookup (optional)
 *
 * @designTokens
 * - Uses default color palette: blue, green, amber, red, violet, cyan, orange, lime, pink, indigo
 * - Card container with rounded-xlarge border
 * - Legend at bottom with horizontal layout
 *
 * @useCase
 * - Sentiment distribution (positive/neutral/negative)
 * - Market share breakdown
 * - Category proportions
 * - Status distribution
 *
 * @example
 * ```tsx
 * // Basic pie chart
 * <DynamicPieChart
 *   title="Sentiment Distribution"
 *   data={[
 *     { name: "POSITIVE", value: 2437 },
 *     { name: "NEUTRAL", value: 156 },
 *     { name: "NEGATIVE", value: 89 },
 *   ]}
 *   colors={["#22c55e", "#94a3b8", "#ef4444"]}
 * />
 *
 * // Donut chart with custom colors
 * <DynamicPieChart
 *   title="Category Breakdown"
 *   data={categoryData}
 *   innerRadius={60}
 *   outerRadius={100}
 * />
 * ```
 */
export function DynamicPieChart({
  title,
  description,
  data,
  colors = PIE_CHART_COLORS,
  innerRadius = 0,
  outerRadius = 100,
  height = DEFAULT_CHART_HEIGHT,
  showLegend = true,
  showLabel = false,
  isLoading = false,
  normalizeKey,
}: DynamicPieChartProps): React.ReactNode {
  const chartHeight = height ?? DEFAULT_CHART_HEIGHT;
  const safeData = useMemo(() => data ?? [], [data]);

  // Build color map with case-insensitive lookup
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    safeData.forEach((entry, index) => {
      const name = entry?.name ?? "";
      const key = normalizeKey ? normalizeKey(name) : name.toLowerCase();
      map[key] = colors[index % colors.length];
    });
    return map;
  }, [safeData, colors, normalizeKey]);

  const getColor = (name: string, index: number): string => {
    const safeName = name ?? "";
    const key = normalizeKey ? normalizeKey(safeName) : safeName.toLowerCase();
    return colorMap[key] || colors[index % colors.length];
  };

  if (isLoading) {
    return (
      <Card className="gap-6">
        {(title || description) && (
          <CardHeader>
            {title && <CardTitle className="w-fit">{title}</CardTitle>}
            {description ? (
              <CardDescription>{description}</CardDescription>
            ) : (
              <CardDescription hidden />
            )}
          </CardHeader>
        )}
        <CardContent>
          <Skeleton className={cn("w-full", `h-[${chartHeight}px]`)} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-6">
      {(title || description) && (
        <CardHeader>
          {title && (
            <CardTitle
              className="w-fit"
              data-editable="title"
              data-prop="title"
            >
              {title}
            </CardTitle>
          )}
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : (
            <CardDescription hidden />
          )}
        </CardHeader>
      )}
      <CardContent>
        <div className={cn("w-full", `h-[${chartHeight}px]`)}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={safeData}
                cx="50%"
                cy="50%"
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                paddingAngle={innerRadius > 0 ? 2 : 0}
                dataKey="value"
                nameKey="name"
                label={showLabel}
              >
                {safeData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getColor(entry?.name ?? "", index)}
                  />
                ))}
              </Pie>
              <RechartsTooltip />
              {showLegend && (
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value: string) => (
                    <span className="text-sm text-gray-600">{value}</span>
                  )}
                />
              )}
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
