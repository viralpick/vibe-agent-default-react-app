import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import * as LucideIcons from "lucide-react";
import { StarIcon } from "lucide-react";
import React from "react";

import { useTranslation } from "@/hooks/useTranslation";
import { cn, getColorClass } from "@/lib/commerce-sdk";
import { Skeleton } from "../ui/skeleton";

/**
 * @component StatusCard
 * @description A versatile metric card supporting various data display modes including
 * progress bars, ratings, percentages, and period-over-period metrics (MoM/WoW/DoD).
 *
 * @dataStructure
 * - title: string | React.ReactNode - Metric label or EditableText component (required)
 * - icon?: React.ElementType - Lucide icon component for the metric (optional)
 * - isLoading: boolean - Shows skeleton when true (required)
 * - value?: number | string - Primary value to display (optional)
 * - maxValue?: number | string - Maximum/target value for comparison (optional)
 * - note?: string - Additional note text below value (optional)
 * - format?: { type, locale, currency, fractionDigits } - Value formatting options (optional)
 *   - type: "number" | "currency" | "percent" | "rating"
 * - percent?: { value: number, color?: string } - Show percentage with progress bar in header (optional)
 * - progress?: { current: number, max: number, color?: string } - Full progress bar with scale (optional)
 * - metrics?: { mom?: number, wow?: number, dod?: number } - Period comparison percentages (optional)
 * - rating?: { value: number, max?: number } - Star rating display (optional)
 *
 * @designTokens
 * - Uses flex-1 for flexible card sizing
 * - Green (#2a9d90) for positive metrics, red (#e0654c) for negative
 * - Yellow (#fbbf24) for active stars in rating
 *
 * @useCase
 * - Goal completion tracking with progress bar
 * - Customer satisfaction ratings
 * - Revenue with MoM/WoW/DoD comparison
 * - Any metric requiring multiple display formats
 *
 * @example
 * ```tsx
 * // With progress bar
 * <StatusCard
 *   title={
 *     <EditableText data-editable="true" data-line-number="52">
 *       Revenue
 *     </EditableText>
 *   }
 *   value={85}
 *   maxValue={100}
 *   format={{ type: "percent" }}
 *   progress={{ current: 85, max: 100, color: "#22c55e" }}
 * />
 *
 * // With rating
 * <StatusCard
 *   title={
 *     <EditableText data-editable="true" data-line-number="52">
 *       Revenue
 *     </EditableText>
 *   }
 *   rating={{ value: 4.5, max: 5 }}
 *   format={{ type: "rating" }}
 * />
 *
 * // With period metrics
 * <StatusCard
 *   title={
 *     <EditableText data-editable="true" data-line-number="52">
 *       Revenue
 *     </EditableText>
 *   }
 *   value={12500000}
 *   format={{ type: "currency" }}
 *   metrics={{ mom: 5.2, wow: -1.3, dod: 2.1 }}
 *   icon={TrendingUp}
 * />
 * ```
 */
export type StatusCardProps = {
  title: string | React.ReactNode;
  icon?: React.ElementType;
  value?: number | string;
  maxValue?: number | string;
  isLoading: boolean;
  note?: string;
  percent?: {
    value: number;
    color?: string;
  };
  format?: {
    type?: "number" | "currency" | "percent" | "rating";
    locale?: string;
    currency?: string;
    fractionDigits?: number;
  };
  progress?: {
    current: number;
    max: number;
    color?: string;
  };
  metrics?: {
    mom?: number;
    wow?: number;
    dod?: number;
  };
  rating?: {
    value: number;
    max?: number;
  };
};

const formatValue = (
  value: number | string | undefined,
  format?: StatusCardProps["format"],
  ratingSuffix?: string,
): string => {
  if (value === undefined || value === null) return "";

  if (!format) return String(value);

  if (format.type === "currency") {
    return new Intl.NumberFormat(format.locale || "ko-KR", {
      style: "currency",
      currency: format.currency || "KRW",
      minimumFractionDigits: format.fractionDigits ?? 0,
    }).format(Number(value));
  }

  if (format.type === "percent") {
    return `${Number(value).toFixed(format.fractionDigits ?? 1)}%`;
  }

  if (format.type === "number") {
    if (format.type === "number") {
      return new Intl.NumberFormat(format.locale || "ko-KR", {
        minimumFractionDigits: format.fractionDigits ?? 0,
        maximumFractionDigits: format.fractionDigits ?? 0,
      }).format(Number(value));
    }
  }

  if (format.type === "rating") {
    return `${Number(value).toFixed(format.fractionDigits ?? 1)}${ratingSuffix ?? "점"}`;
  }

  return String(value);
};

const renderMainValue = (
  value?: number | string,
  maxValue?: number | string,
  format?: StatusCardProps["format"],
  ratingSuffix?: string,
) => {
  if (value === undefined && maxValue === undefined) return null;

  if (value !== undefined && maxValue !== undefined) {
    return (
      <div className="flex text-h3 font-bold gap-1">
        <span>{formatValue(value, format, ratingSuffix)}</span>
        <span className="text-state-400">/</span>
        <span>{formatValue(maxValue, format, ratingSuffix)}</span>
      </div>
    );
  }

  if (value !== undefined) {
    return (
      <div className="text-h3 font-bold">
        {formatValue(value, format, ratingSuffix)}
      </div>
    );
  }

  if (maxValue !== undefined) {
    return (
      <div className="text-h3 font-bold">
        {formatValue(maxValue, format, ratingSuffix)}
      </div>
    );
  }

  return null;
};

export function StatusCard({
  title,
  icon,
  value,
  maxValue,
  note,
  percent,
  format,
  progress,
  metrics,
  rating,
  isLoading,
}: StatusCardProps): React.JSX.Element {
  const t = useTranslation();
  const Icon = icon
    ? (LucideIcons[icon as keyof typeof LucideIcons] as React.ElementType)
    : null;

  if (isLoading)
    return <Skeleton className="h-[130px] w-full rounded-xlarge" />;

  return (
    <Card className="flex-1 rounded-large border-border-200 h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-label-l font-medium text-text-secondary">
          {title}
        </CardTitle>
        {percent ? (
          <div className="flex items-center gap-0.5">
            <Progress
              value={percent.value}
              className="w-[56px] flex-row items-center gap-1"
            >
              <Progress.Bar
                indicatorClassName={
                  percent.color ? getColorClass(percent.color) : "bg-[#2a9d90]"
                }
              />
            </Progress>
            <span
              className="text-body-s"
              style={{
                color: percent.color || "#2a9d90",
              }}
            >
              {percent.value}%
            </span>
          </div>
        ) : (
          Icon && <Icon className="size-4 text-icon-secondary" />
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2 px-5">
          {renderMainValue(value, maxValue, format, t.statusCard.ratingSuffix)}
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
          {progress && (
            <div>
              <Progress value={progress.current} max={progress.max}>
                <Progress.Bar
                  indicatorClassName={
                    progress.color
                      ? getColorClass(progress.color)
                      : "bg-[#2a9d90]"
                  }
                />
              </Progress>
              <p className="flex text-xs text-muted-foreground mt-0.25 justify-between">
                <span>0</span>
                <span>{progress.max}</span>
              </p>
            </div>
          )}
          {rating && (
            <div className="flex items-center gap-1.5">
              {[...Array(rating.max || 5)].map((_, i) => (
                <StarIcon
                  key={i}
                  className={cn(
                    "size-5.5 text-[#d9d9d9]",
                    i < Math.round(rating.value) && "text-[#fbbf24]",
                  )}
                />
              ))}
            </div>
          )}
          {metrics && (
            <div className="text-xs text-muted-foreground flex gap-1 flex-wrap">
              {metrics.mom !== undefined && (
                <span className="flex gap-0.5">
                  MoM
                  <span
                    className={
                      metrics.mom > 0 ? "text-[#2a9d90]" : "text-[#e0654c]"
                    }
                  >
                    {metrics.mom > 0 ? "+" : ""}
                    {metrics.mom}%
                  </span>
                </span>
              )}
              {metrics.wow !== undefined && (
                <span className="flex gap-0.5">
                  WoW
                  <span
                    className={
                      metrics.wow > 0 ? "text-[#2a9d90]" : "text-[#e0654c]"
                    }
                  >
                    {metrics.wow > 0 ? "+" : ""}
                    {metrics.wow}%
                  </span>
                </span>
              )}
              {metrics.dod !== undefined && (
                <span className="flex gap-5.5">
                  DoD
                  <span
                    className={
                      metrics.dod > 0 ? "text-[#2a9d90]" : "text-[#e0654c]"
                    }
                  >
                    {metrics.dod > 0 ? "+" : ""}
                    {metrics.dod}%
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
