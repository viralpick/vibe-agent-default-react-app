"use client";

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
} from "recharts";

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

type SeriesType = "line" | "bar" | "area";
type YAxisSide = "left" | "right";

type ComposedSeriesConfig = {
  label: string;
  color: string;
  type?: SeriesType;
  yAxisId?: YAxisSide;
  stackId?: string;
};

export type BaseDynamicChartProps = {
  title?: string;
  description?: string;
  height?: number;
  fullWidth?: boolean;
  xAxisKey: string;
  yAxisKey?: string;
  data: Record<string, unknown>[];
  config: Record<
    string,
    {
      label: string;
      color: string;
    }
  >;
  tooltipIndicator?: "dot" | "line" | "dashed" | false;
  showLegend?: boolean;
  tickFormatter?: (value: string) => string;
};

export type DynamicAreaChartProps = BaseDynamicChartProps & {
  variant?: "monotone" | "linear" | "natural" | "step";
};

export function DynamicAreaChart({
  title,
  description,
  height,
  xAxisKey,
  yAxisKey,
  data,
  config,
  variant = "monotone",
  tooltipIndicator = "dot",
  showLegend = true,
  tickFormatter,
}: DynamicAreaChartProps): React.ReactNode {
  const keys = Object.keys(config);

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
        <ChartContainer config={config} className={`w-full h-[${height}px]`}>
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
              const color = config[key]?.color || "#000000";
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

export function DynamicLineChart({
  title,
  description,
  height,
  xAxisKey,
  yAxisKey,
  data,
  config,
  variant = "monotone",
  tooltipIndicator = "dot",
  showLegend = true,
  tickFormatter,
}: DynamicLineChartProps): React.ReactNode {
  const keys = Object.keys(config);

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
        <ChartContainer config={config} className={`w-full h-[${height}px]`}>
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
              const color = config[key]?.color || "#000000";
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

export function DynamicBarChart({
  title,
  description,
  height,
  xAxisKey,
  yAxisKey,
  data,
  config,
  layout = "vertical",
  tooltipIndicator = "dot",
  showLegend = true,
  tickFormatter,
}: DynamicBarChartProps): React.ReactNode {
  const keys = Object.keys(config);

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
        <ChartContainer config={config} className={`w-full h-[${height}px]`}>
          <BarChart
            accessibilityLayer
            data={data ?? []}
            layout={layout === "horizontal" ? "vertical" : undefined}
            height={height}
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
              const color = config[key]?.color || "#000000";
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
      </CardContent>
    </Card>
  );
}

export type DynamicComposedChartProps = Omit<
  BaseDynamicChartProps,
  "config"
> & {
  config: Record<string, ComposedSeriesConfig>;
  yAxisRightKey?: string;
  variant?: "monotone" | "linear" | "natural" | "step";
  barMaxBarSize?: number;
  areaFillOpacity?: number;
  order?: string[];
};

export function DynamicComposedChart({
  title,
  description,
  height = 320,
  xAxisKey,
  yAxisKey,
  yAxisRightKey,
  data,
  config,
  variant = "monotone",
  tooltipIndicator = "dot",
  showLegend = true,
  tickFormatter,
  barMaxBarSize = 28,
  areaFillOpacity = 0.4,
  order,
}: DynamicComposedChartProps): React.ReactNode {
  const keys = order && order.length ? order : Object.keys(config);
  const hasRight = keys.some((k) => (config[k]?.yAxisId ?? "left") === "right");
  const legendConfig = Object.fromEntries(
    Object.entries(config).map(([k, v]) => [
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
          className={`w-full h-[${height}px]`}
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
              const c = config[key];
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
