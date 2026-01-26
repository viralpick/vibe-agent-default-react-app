/**
 * @fileoverview Chart container and tooltip/legend components for Recharts integration.
 * Provides consistent styling and theming for chart visualizations.
 *
 * @module ui/chart
 */

import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/commerce-sdk";

// Recharts 3.x compatible types
type TooltipPayloadItem = {
  value?: string | number;
  name?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
  color?: string;
  fill?: string;
  type?: string;
};

type LegendPayloadItem = {
  value: string;
  dataKey?: string | number;
  color?: string;
  type?: string;
};

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  );
};

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }

  return context;
}

/**
 * @component ChartContainer
 * @description Wrapper component for Recharts charts. Provides responsive container,
 * theme-aware styling, and configuration context for tooltips/legends.
 *
 * @dataStructure
 * - config: ChartConfig - Series configuration object (required)
 *   - [seriesKey]: { label: string, color: string } | { label: string, theme: { light, dark } }
 * - children: Recharts chart component (required)
 * - className?: string - Additional CSS classes
 *
 * @designTokens
 * - Uses aspect-video for default aspect ratio
 * - Uses text-xs for chart text
 * - Applies consistent styling to Recharts elements
 *
 * @useCase
 * - Wrapping any Recharts chart (LineChart, BarChart, etc.)
 * - Providing consistent theming across charts
 * - Enabling responsive chart sizing
 *
 * @example
 * ```tsx
 * <ChartContainer
 *   config={{
 *     sales: { label: "Sales", color: "#8884d8" },
 *     revenue: { label: "Revenue", color: "#82ca9d" }
 *   }}
 * >
 *   <LineChart data={data}>
 *     <Line dataKey="sales" />
 *     <Line dataKey="revenue" />
 *   </LineChart>
 * </ChartContainer>
 * ```
 */
function ChartContainer({
  id,
  className,
  children,
  config,
  queryId,
  queryContent,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<
    typeof RechartsPrimitive.ResponsiveContainer
  >["children"];
  queryId?: string;
  queryContent?: string;
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        data-query-id={queryId}
        data-query-content={queryContent}
        className={cn(
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border flex aspect-video justify-center text-xs [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, config]) => config.theme || config.color
  );

  if (!colorConfig.length) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
      itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .join("\n")}
}
`
          )
          .join("\n"),
      }}
    />
  );
};

const ChartTooltip = RechartsPrimitive.Tooltip;

/**
 * @component ChartTooltipContent
 * @description Custom tooltip content component for Recharts. Displays series values
 * with color indicators and formatted labels.
 *
 * @dataStructure
 * - active?: boolean - Whether tooltip is active (from Recharts)
 * - payload?: TooltipPayloadItem[] - Data items to display (from Recharts)
 * - label?: string | number - Tooltip header label
 * - indicator?: "dot" | "line" | "dashed" - Color indicator style
 * - hideLabel?: boolean - Hide the header label
 * - hideIndicator?: boolean - Hide color indicators
 * - formatter?: (value, name, item, index, payload) => ReactNode - Custom formatter
 *
 * @useCase
 * - Custom chart tooltips with consistent styling
 * - Multi-series value display on hover
 *
 * @example
 * ```tsx
 * <ChartTooltip
 *   content={<ChartTooltipContent indicator="dot" />}
 * />
 * ```
 */
function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClassName,
  formatter,
  color,
  nameKey,
  labelKey,
}: React.ComponentProps<"div"> & {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  labelFormatter?: (
    label: unknown,
    payload: TooltipPayloadItem[]
  ) => React.ReactNode;
  formatter?: (
    value: string | number,
    name: string,
    item: TooltipPayloadItem,
    index: number,
    payload: Record<string, unknown>
  ) => React.ReactNode;
  hideLabel?: boolean;
  hideIndicator?: boolean;
  indicator?: "line" | "dot" | "dashed";
  nameKey?: string;
  labelKey?: string;
  labelClassName?: string;
  color?: string;
}) {
  const { config } = useChart();

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) {
      return null;
    }

    const [item] = payload;
    const key = `${labelKey || item?.dataKey || item?.name || "value"}`;
    const itemConfig = getPayloadConfigFromPayload(config, item, key);
    const value =
      !labelKey && typeof label === "string"
        ? config[label as keyof typeof config]?.label || label
        : itemConfig?.label;

    if (labelFormatter) {
      return (
        <div className={cn("font-medium", labelClassName)}>
          {labelFormatter(value, payload)}
        </div>
      );
    }

    if (!value) {
      return null;
    }

    return <div className={cn("font-medium", labelClassName)}>{value}</div>;
  }, [
    label,
    labelFormatter,
    payload,
    hideLabel,
    labelClassName,
    config,
    labelKey,
  ]);

  if (!active || !payload?.length) {
    return null;
  }

  const nestLabel = payload.length === 1 && indicator !== "dot";

  return (
    <div
      className={cn(
        "bg-[#ffffff] grid min-w-[8rem] items-start gap-6 rounded-xlarge border border-gray-200 px-12 py-8 text-xs shadow-lg",
        className
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="grid gap-6">
        {payload
          .filter((item) => item.type !== "none")
          .map((item, index) => {
            const key = `${nameKey || item.name || item.dataKey || "value"}`;
            const itemConfig = getPayloadConfigFromPayload(config, item, key);
            const indicatorColor =
              color || (item.payload?.fill as string) || item.color;

            return (
              <div
                key={item.dataKey}
                className={cn(
                  "[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-8 [&>svg]:h-10 [&>svg]:w-10",
                  indicator === "dot" && "items-center"
                )}
              >
                {formatter && item?.value !== undefined && item.name ? (
                  formatter(
                    item.value,
                    item.name,
                    item,
                    index,
                    item.payload ?? {}
                  )
                ) : (
                  <div className="flex items-center justify-between gap-12 w-full min-w-[140px]">
                    <div className="flex items-center gap-2">
                      {itemConfig?.icon ? (
                        <itemConfig.icon />
                      ) : (
                        !hideIndicator && (
                          <div
                            className={cn("shrink-0 rounded-[3px]", {
                              "h-8 w-8": indicator === "dot",
                              "w-1 h-3": indicator === "line",
                              "w-0 h-3 border-[1.5px] border-dashed bg-transparent":
                                indicator === "dashed",
                            })}
                            style={{
                              backgroundColor:
                                indicator !== "dashed"
                                  ? indicatorColor
                                  : undefined,
                              borderColor:
                                indicator === "dashed"
                                  ? indicatorColor
                                  : undefined,
                            }}
                          />
                        )
                      )}
                      <span className="text-muted-foreground">
                        {itemConfig?.label || item.name}
                      </span>
                    </div>
                    {item.value !== undefined && (
                      <span className="text-foreground font-mono font-medium tabular-nums">
                        {item.value.toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

const ChartLegend = RechartsPrimitive.Legend;

/**
 * @component ChartLegendContent
 * @description Custom legend content component for Recharts. Displays series labels
 * with color indicators.
 *
 * @dataStructure
 * - payload?: LegendPayloadItem[] - Legend items (from Recharts)
 * - hideIcon?: boolean - Hide color indicators
 * - verticalAlign?: "top" | "bottom" | "middle" - Legend position
 * - nameKey?: string - Key to use for series names
 *
 * @useCase
 * - Custom chart legends with consistent styling
 * - Series identification below/above charts
 *
 * @example
 * ```tsx
 * <Legend content={<ChartLegendContent />} />
 * ```
 */
function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = "bottom",
  nameKey,
}: React.ComponentProps<"div"> & {
  hideIcon?: boolean;
  nameKey?: string;
  payload?: LegendPayloadItem[];
  verticalAlign?: "top" | "bottom" | "middle";
}) {
  const { config } = useChart();

  if (!payload?.length) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-12",
        verticalAlign === "top" ? "pb-12" : "pt-12",
        className
      )}
    >
      {payload
        .filter((item) => item.type !== "none")
        .map((item) => {
          const key = `${nameKey || item.dataKey || "value"}`;
          const itemConfig = getPayloadConfigFromPayload(config, item, key);

          return (
            <div
              key={item.value}
              className={cn(
                "[&>svg]:text-muted-foreground flex items-center gap-6 [&>svg]:h-12 [&>svg]:w-12"
              )}
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="h-8 w-8 shrink-0 rounded-[2px]"
                  style={{
                    backgroundColor: item.color,
                  }}
                />
              )}
              {itemConfig?.label}
            </div>
          );
        })}
    </div>
  );
}

// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string
) {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const payloadPayload =
    "payload" in payload &&
    typeof payload.payload === "object" &&
    payload.payload !== null
      ? payload.payload
      : undefined;

  let configLabelKey: string = key;

  if (
    key in payload &&
    typeof payload[key as keyof typeof payload] === "string"
  ) {
    configLabelKey = payload[key as keyof typeof payload] as string;
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key as keyof typeof payloadPayload] === "string"
  ) {
    configLabelKey = payloadPayload[
      key as keyof typeof payloadPayload
    ] as string;
  }

  return configLabelKey in config
    ? config[configLabelKey]
    : config[key as keyof typeof config];
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
};