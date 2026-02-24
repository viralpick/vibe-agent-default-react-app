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
  Brush,
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
  Skeleton,
} from "@viralpick/synapse";
import { normalizeNumericValue } from "./data-utils";
import { format } from "date-fns";

const DEFAULT_CHART_HEIGHT = 300;

/**
 * Normalizes chart data by converting object values to numbers.
 * Handles GraphQL response patterns where numeric values are wrapped in objects.
 */
const normalizeChartData = (data: Record<string, unknown>[]): Record<string, unknown>[] => {
  if (!Array.isArray(data)) return [];
  return data.map((item) => {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(item)) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        normalized[key] = normalizeNumericValue(value);
      } else {
        normalized[key] = value;
      }
    }
    return normalized;
  });
};

/**
 * Formats large numbers with K/M/B suffixes for better readability on axes
 * @param value - The numeric value to format
 * @returns Formatted string with appropriate suffix
 */
const formatAxisNumber = (value: number): string => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
};

/**
 * Formats brush tick values - converts dates to yyyy-MM-dd format if possible
 * @param value - The tick value to format
 * @returns Formatted string
 */
const formatBrushTick = (value: unknown): string => {
  if (value == null) return "";
  const strValue = String(value);
  
  // Try to parse as date
  const date = new Date(strValue);
  if (!isNaN(date.getTime()) && strValue.length > 6) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  
  return strValue;
};

/**
 * Formats date values to M/D format for display
 * @param value - The date value to format
 * @returns Formatted string in M/D format or original value if not a date
 */
const formatDateShort = (value: unknown): string => {
  if (value == null) return "";
  const strValue = String(value);
  
  // Check if it looks like an ISO date (YYYY-MM-DD...)
  if (/^\d{4}-\d{2}-\d{2}/.test(strValue)) {
    const date = new Date(strValue);
    if (!isNaN(date.getTime())) {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  }
  
  return strValue;
};

/**
 * Checks if a value looks like an ISO date string
 */
const isISODateString = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}/.test(value);
};

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
  title?: string | React.ReactNode;
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
  /** Query ID for query edit mode (optional) */
  queryId?: string;
  /** Query content for query edit mode (optional) */
  queryContent?: string;
};

export type DynamicAreaChartProps = BaseDynamicChartProps & {
  variant?: "monotone" | "linear" | "natural" | "step";
  /** Show loading skeleton */
  isLoading?: boolean;
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
  isLoading = false,
  queryId,
  queryContent,
}: DynamicAreaChartProps): React.ReactNode {
  const effectiveConfig = series ?? config ?? {};
  const keys = Object.keys(effectiveConfig);
  const chartHeight = height ?? DEFAULT_CHART_HEIGHT;
  const normalizedData = useMemo(() => normalizeChartData(data ?? []), [data]);
  const dataCount = normalizedData.length;
  
  // Auto-determine brush and x-axis labels based on data count
  const showBrush = dataCount > 5;
  const hideXAxisLabels = dataCount >= 30;

  // Auto-detect date format and apply formatting
  const autoTickFormatter = useMemo(() => {
    if (tickFormatter) return tickFormatter;
    const firstValue = normalizedData[0]?.[xAxisKey];
    if (isISODateString(firstValue)) {
      return formatDateShort;
    }
    return undefined;
  }, [tickFormatter, normalizedData, xAxisKey]);

  // Format tooltip labels for dates
  const tooltipLabelFormatter = useMemo(() => {
    const firstValue = normalizedData[0]?.[xAxisKey];
    if (isISODateString(firstValue)) {
      return (value: unknown) => {
        const strValue = String(value ?? '');
        const date = new Date(strValue);
        if (!isNaN(date.getTime())) {
          return format(date,'yyyy-MM-dd')
        }
        return strValue;
      };
    }
    return undefined;
  }, [normalizedData, xAxisKey]);

  if (isLoading) {
    return (
      <Card className="gap-1.5" queryId={queryId} queryContent={queryContent}>
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
        <CardContent className="px-4">
          <Skeleton className="w-full" style={{ height: chartHeight }} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-1.5" queryId={queryId} queryContent={queryContent}>
      {(title || description) && (
        <CardHeader>
          {title && (
            <CardTitle className="w-fit">
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
          className="w-full"
          style={{ height: chartHeight }}
        >
          <AreaChart
            accessibilityLayer
            data={normalizedData}
            height={chartHeight}
            margin={{ top: 0, right: 25, bottom: showBrush ? 30 : 0, left: 15 }}
          >
            <CartesianGrid vertical={false} stroke="#ebebeb" />
            <XAxis
              dataKey={xAxisKey}
              tickLine={false}
              axisLine={false}
              tickMargin={5}
              tickFormatter={autoTickFormatter}
              fontSize={10}
              interval={showBrush ? "preserveStartEnd" : 0}
              tick={hideXAxisLabels ? false : undefined}
              dx={10}
              dy={0}
            />
            <YAxis
              dataKey={yAxisKey}
              fontSize={12}
              tickLine={false}
              tickMargin={8}
              axisLine={false}
              tickFormatter={formatAxisNumber}
            />
            {tooltipIndicator !== false && (
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator={tooltipIndicator} labelFormatter={tooltipLabelFormatter} />}
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
            {showBrush && (
              <Brush
                dataKey={xAxisKey}
                height={10}
                stroke="#d1d5db"
                startIndex={0}
                endIndex={Math.min(4, dataCount - 1)}
                tickFormatter={formatBrushTick}
              />
            )}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export type DynamicLineChartProps = BaseDynamicChartProps & {
  variant?: "monotone" | "linear" | "natural" | "step";
  /** Show loading skeleton */
  isLoading?: boolean;
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
  isLoading = false,
  queryId,
  queryContent,
}: DynamicLineChartProps): React.ReactNode {
  const effectiveConfig = series ?? config ?? {};
  const keys = Object.keys(effectiveConfig);
  const chartHeight = height ?? DEFAULT_CHART_HEIGHT;
  const normalizedData = useMemo(() => normalizeChartData(data ?? []), [data]);
  const dataCount = normalizedData.length;
  
  // Auto-determine brush and x-axis labels based on data count
  const showBrush = dataCount > 5;
  const hideXAxisLabels = dataCount >= 30;

  // Auto-detect date format and apply formatting
  const autoTickFormatter = useMemo(() => {
    if (tickFormatter) return tickFormatter;
    // Check first data item for ISO date format
    const firstValue = normalizedData[0]?.[xAxisKey];
    if (isISODateString(firstValue)) {
      return formatDateShort;
    }
    return undefined;
  }, [tickFormatter, normalizedData, xAxisKey]);

  // Format tooltip labels for dates
  const tooltipLabelFormatter = useMemo(() => {
    const firstValue = normalizedData[0]?.[xAxisKey];
    if (isISODateString(firstValue)) {
      // 모든 데이터의 시간(HH:mm:ss) 부분이 동일한지 체크
      const uniqueTimes = new Set(
        normalizedData.map((item) => {
          const value = item[xAxisKey];
          if (!isISODateString(value)) return null;
          const date = new Date(String(value));
          return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
        }).filter((time) => time !== null)
      );
      const allSameTime = uniqueTimes.size <= 1;
      const dateFormat = allSameTime ? 'yyyy-MM-dd' : 'yyyy-MM-dd HH:mm:ss';

      return (value: unknown) => {
        const strValue = String(value ?? '');
        const date = new Date(strValue);
        if (!isNaN(date.getTime())) {
          return format(date, dateFormat);
        }
        return strValue;
      };
    }
    return undefined;
  }, [normalizedData, xAxisKey]);

  if (isLoading) {
    return (
      <Card className="gap-1.5" queryId={queryId} queryContent={queryContent}>
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
        <CardContent className="px-4">
          <Skeleton className="w-full" style={{ height: chartHeight }} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-1.5" queryId={queryId} queryContent={queryContent}>
      {(title || description) && (
        <CardHeader>
          {title && (
            <CardTitle className="w-fit">
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
          className="w-full"
          style={{ height: chartHeight }}
        >
          <LineChart
            accessibilityLayer
            data={normalizedData}
            height={chartHeight}
            margin={{ top: 0, right: 25, bottom: showBrush ? 30 : 0, left: 15 }}
          >
            <CartesianGrid vertical={false} stroke="#ebebeb" />
            <XAxis
              dataKey={xAxisKey}
              tickLine={false}
              axisLine={false}
              tickMargin={5}
              tickFormatter={autoTickFormatter}
              fontSize={10}
              interval={showBrush ? "preserveStartEnd" : 0}
              tick={hideXAxisLabels ? false : undefined}
              dx={10}
              dy={0}
            />
            <YAxis
              dataKey={yAxisKey}
              fontSize={12}
              tickLine={false}
              tickMargin={8}
              axisLine={false}
              tickFormatter={formatAxisNumber}
            />
            {tooltipIndicator !== false && (
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator={tooltipIndicator} labelFormatter={tooltipLabelFormatter} />}
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
            {showBrush && (
              <Brush
                dataKey={xAxisKey}
                height={10}
                stroke="#d1d5db"
                startIndex={0}
                endIndex={Math.min(4, dataCount - 1)}
                tickFormatter={formatBrushTick}
              />
            )}
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
  queryId,
  queryContent,
}: DynamicBarChartProps & {
  isLoading?: boolean;
}): React.ReactNode {
  const effectiveConfig = series ?? config ?? {};
  const keys = Object.keys(effectiveConfig);
  const baseHeight = height ?? DEFAULT_CHART_HEIGHT;
  const normalizedData = useMemo(() => normalizeChartData(data ?? []), [data]);

  // For horizontal layout, calculate height based on data count
  const barHeight = 36; // height per bar item
  const dataCount = normalizedData.length;

  // Auto-determine brush and x-axis labels based on data count (vertical layout only)
  const showBrush = layout === "vertical" && dataCount > 5;
  const hideXAxisLabels = layout === "vertical" && dataCount >= 30;

  // Auto-detect date format and apply formatting
  const autoTickFormatter = useMemo(() => {
    if (tickFormatter) return tickFormatter;
    const firstValue = normalizedData[0]?.[xAxisKey];
    if (isISODateString(firstValue)) {
      return formatDateShort;
    }
    return undefined;
  }, [tickFormatter, normalizedData, xAxisKey]);

  // Format tooltip labels for dates
  const tooltipLabelFormatter = useMemo(() => {
    const firstValue = normalizedData[0]?.[xAxisKey];
    if (isISODateString(firstValue)) {
      return (value: unknown) => {
        const strValue = String(value ?? '');
        const date = new Date(strValue);
        if (!isNaN(date.getTime())) {
          return format(date,'yyyy-MM-dd')
        }
        return strValue;
      };
    }
    return undefined;
  }, [normalizedData, xAxisKey]);

  const chartHeight = useMemo(() => {
    if (layout !== "horizontal") return baseHeight;
    // Calculate dynamic height based on data count
    const calculatedHeight = dataCount * barHeight + 40; // 40px for padding
    return Math.max(baseHeight, calculatedHeight);
  }, [layout, dataCount, baseHeight]);

  // Actual chart height (for scrollable content)
  const actualChartHeight = useMemo(() => {
    if (layout !== "horizontal") return chartHeight;
    return dataCount * barHeight + 40;
  }, [layout, dataCount, chartHeight]);

  // Whether scrolling is needed (horizontal layout only)
  const needsScroll =
    layout === "horizontal" && actualChartHeight > chartHeight;

  const charWidth = 7;
  const minWidth = 60;
  const maxWidth = 200;

  const autoYAxisWidth = useMemo(() => {
    if (layout !== "horizontal" || !yAxisKey) return undefined;
    const maxLen = normalizedData.reduce((m, d) => {
      const v = String((d as Record<string, unknown>)[yAxisKey] ?? "");
      return Math.max(m, v.length);
    }, 0);
    const est = maxLen * charWidth + 16;
    return Math.min(maxWidth, Math.max(minWidth, est));
  }, [layout, yAxisKey, normalizedData]);

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
      <Card className="gap-1.5" queryId={queryId} queryContent={queryContent}>
        {(title || description) && (
          <CardHeader>
            {title && (
              <CardTitle className="w-fit">
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
        <CardContent className="px-4">
          <Skeleton className="w-full" style={{ height: chartHeight }} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-1.5" queryId={queryId} queryContent={queryContent}>
      {(title || description) && (
        <CardHeader>
          {title && (
            <CardTitle className="w-fit">
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
          className={cn("w-full", needsScroll && "overflow-y-auto")}
          style={{ height: chartHeight, maxHeight: chartHeight }}
        >
          <ChartContainer
            config={effectiveConfig}
            className="w-full"
            style={{ height: actualChartHeight, minHeight: actualChartHeight }}
          >
            <BarChart
              accessibilityLayer
              data={normalizedData}
              layout={layout === "horizontal" ? "vertical" : undefined}
              height={actualChartHeight}
              margin={
                layout === "horizontal"
                  ? { top: 0, right: 15, bottom: 0, left: 40 }
                  : {
                      top: 0,
                      right: 25,
                      bottom: showBrush ? 30 : 0,
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
                  tickFormatter={autoTickFormatter}
                  interval={showBrush ? "preserveStartEnd" : 0}
                  tick={hideXAxisLabels ? false : undefined}
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
                  tick={<AutoTick x={0} y={0} payload={{ value: "" }} />}
                />
              ) : (
                <YAxis
                  dataKey={yAxisKey}
                  fontSize={12}
                  tickLine={false}
                  tickMargin={8}
                  axisLine={false}
                  tickFormatter={formatAxisNumber}
                />
              )}
              {tooltipIndicator !== false && (
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator={tooltipIndicator} labelFormatter={tooltipLabelFormatter} />}
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
                    radius={
                      layout === "horizontal" ? [0, 4, 4, 0] : [4, 4, 0, 0]
                    }
                  />
                );
              })}
              {showBrush && (
                <Brush
                  dataKey={xAxisKey}
                  height={10}
                  stroke="#d1d5db"
                  startIndex={0}
                  endIndex={Math.min(4, dataCount - 1)}
                  tickFormatter={formatBrushTick}
                />
              )}
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
  queryId,
  queryContent,
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
  const normalizedData = useMemo(() => normalizeChartData(data ?? []), [data]);
  const dataCount = normalizedData.length;
  
  // Auto-determine brush based on data count
  const showBrush = dataCount > 5;

  return (
    <Card className="gap-1.5" queryId={queryId} queryContent={queryContent}>
      {(title || description) && (
        <CardHeader>
          {title && (
            <CardTitle className="w-fit">
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
          className="w-full"
          style={{ height }}
        >
          <ComposedChart
            accessibilityLayer
            data={normalizedData}
            height={height}
            margin={{ top: 0, right: 25, bottom: showBrush ? 30 : 0, left: 15 }}
          >
            <CartesianGrid vertical={false} stroke="#ebebeb" />
            <XAxis
              dataKey={xAxisKey}
              tickLine={false}
              axisLine={false}
              tickMargin={5}
              tickFormatter={tickFormatter}
              fontSize={10}
              interval={showBrush ? "preserveStartEnd" : 0}
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
              tickFormatter={formatAxisNumber}
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
                tickFormatter={formatAxisNumber}
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
            {showBrush && (
              <Brush
                dataKey={xAxisKey}
                height={10}
                stroke="#d1d5db"
                startIndex={0}
                endIndex={Math.min(4, dataCount - 1)}
                tickFormatter={formatBrushTick}
              />
            )}
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

const PIE_OTHER_COLOR = "#9ca3af"; // gray-400
const LEGEND_AUTO_HIDE_THRESHOLD = 10;

/**
 * Props for DynamicPieChart component
 */
export type DynamicPieChartProps = {
  title?: string | React.ReactNode;
  description?: string;
  data: { name: string; value: number }[];
  colors?: string[];
  innerRadius?: number;
  outerRadius?: number;
  height?: number;
  showLegend?: boolean;
  showLabel?: boolean;
  isLoading?: boolean;
  /** Max number of pie segments. Excess items are grouped into "기타". */
  maxItems?: number;
  /** Optional key normalization function for color mapping */
  normalizeKey?: (key: string) => string;
  /** Query ID for query edit mode (optional) */
  queryId?: string;
  /** Query content for query edit mode (optional) */
  queryContent?: string;
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
 * - maxItems?: number - Max segments before grouping extras into "기타" (optional, default: 6)
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
  maxItems = 6,
  normalizeKey,
  queryId,
  queryContent,
}: DynamicPieChartProps): React.ReactNode {
  const chartHeight = height ?? DEFAULT_CHART_HEIGHT;
  // Normalize pie data: ensure value is a number (handle object form like { review_id: 4 })
  const safeData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      name: item?.name ?? "",
      value: typeof item?.value === 'object' && item?.value !== null
        ? normalizeNumericValue(item.value)
        : (typeof item?.value === 'number' ? item.value : 0),
    }));
  }, [data]);

  const limitedData = useMemo(() => {
    if (safeData.length <= maxItems) return safeData;

    const sorted = [...safeData].sort((a, b) => b.value - a.value);
    const topItems = sorted.slice(0, maxItems - 1);
    const otherItems = sorted.slice(maxItems - 1);
    const otherSum = otherItems.reduce((sum, item) => sum + item.value, 0);

    return [...topItems, { name: "기타", value: otherSum }];
  }, [safeData, maxItems]);

  // Build color map with case-insensitive lookup (name may be number from API e.g. promotion_id)
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    limitedData.forEach((entry, index) => {
      const raw = entry?.name;
      const name = raw != null ? String(raw) : "";
      if (name === "기타") {
        map["기타"] = PIE_OTHER_COLOR;
      } else {
        const key = normalizeKey ? normalizeKey(name) : name.toLowerCase();
        map[key] = colors[index % colors.length];
      }
    });
    return map;
  }, [limitedData, colors, normalizeKey]);

  const getColor = (name: string | number, index: number): string => {
    const safeName = name != null ? String(name) : "";
    if (safeName === "기타") return PIE_OTHER_COLOR;
    const key = normalizeKey ? normalizeKey(safeName) : safeName.toLowerCase();
    return colorMap[key] || colors[index % colors.length];
  };

  const shouldShowLegend = showLegend && limitedData.length <= LEGEND_AUTO_HIDE_THRESHOLD;

  if (isLoading) {
    return (
      <Card className="gap-1.5" queryId={queryId} queryContent={queryContent}>
        {(title || description) && (
          <CardHeader>
            {title && (
              <CardTitle className="w-fit">
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
        <CardContent className="px-4">
          <Skeleton className="w-full" style={{ height: chartHeight }} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-1.5" queryId={queryId} queryContent={queryContent}>
      {(title || description) && (
        <CardHeader>
          {title && (
            <CardTitle className="w-fit">
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
        <div className="w-full" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={limitedData}
                cx="50%"
                cy="50%"
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                paddingAngle={innerRadius > 0 ? 2 : 0}
                dataKey="value"
                nameKey="name"
                label={showLabel}
              >
                {limitedData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getColor(entry?.name ?? "", index)}
                  />
                ))}
              </Pie>
              <RechartsTooltip />
              {shouldShowLegend && (
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
