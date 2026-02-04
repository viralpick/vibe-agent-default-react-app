"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/commerce-sdk";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/dropdown";
import {
  DatePickerProvider,
  DatePickerCalendar,
} from "@/components/ui/date-picker";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Preset option for quick date selection
 */
export type DatePresetOption = {
  id: string;
  label: string;
  days: number;
};

/**
 * Selected date period value
 */
export type DatePeriodValue = {
  type: "preset" | "month" | "range";
  from: Date;
  to: Date;
  label: string;
};

/**
 * Props for DatePeriodSelector component
 */
export type DatePeriodSelectorProps = {
  value?: DatePeriodValue;
  onChange: (value: DatePeriodValue) => void;
  presets?: DatePresetOption[];
  monthsCount?: number;
  placeholder?: string;
  className?: string;
  size?: "default" | "sm";
  align?: "start" | "center" | "end";
};

const DEFAULT_PRESETS: DatePresetOption[] = [
  { id: "today", label: "오늘", days: 0 },
  { id: "7days", label: "최근 7일", days: 7 },
  { id: "30days", label: "최근 30일", days: 30 },
  { id: "90days", label: "최근 90일", days: 90 },
];

/**
 * Creates the default DatePeriodValue (최근 30일)
 * Shared between DatePeriodSelector and injectDateFilters for consistency
 */
export function getDefaultDatePeriod(): DatePeriodValue {
  const today = new Date();
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const from = new Date(today);
  from.setDate(today.getDate() - 30);
  from.setHours(0, 0, 0, 0);

  return {
    type: "preset",
    from,
    to,
    label: "최근 30일",
  };
}

/**
 * Generates month options for the past N months
 */
function getMonthOptions(
  count: number
): { id: string; label: string; from: Date; to: Date }[] {
  const options: { id: string; label: string; from: Date; to: Date }[] = [];
  const today = new Date();

  for (let i = 0; i < count; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth();

    const from = new Date(year, month, 1);
    const to = new Date(year, month + 1, 0); // Last day of month

    const id = `${year}-${String(month + 1).padStart(2, "0")}`;
    const label = `${year}년 ${month + 1}월`;

    options.push({ id, label, from, to });
  }

  return options;
}

/**
 * Formats a date range for display
 */
function formatDateRange(from: Date, to: Date): string {
  const formatDate = (d: Date) =>
    `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
      d.getDate()
    ).padStart(2, "0")}`;
  return `${formatDate(from)} - ${formatDate(to)}`;
}

/**
 * @component DatePeriodSelector
 * @description A comprehensive date period selector supporting presets, monthly selection,
 * and custom date range picking via calendar. Used for filtering dashboard data by time period.
 *
 * @dataStructure
 * - value?: DatePeriodValue - Currently selected period (optional)
 *   - type: "preset" | "month" | "range" - Selection type
 *   - from: Date - Start date
 *   - to: Date - End date
 *   - label: string - Display label
 * - onChange: (value: DatePeriodValue) => void - Callback when period changes (required)
 * - presets?: DatePresetOption[] - Quick selection presets (optional, default: 오늘, 최근 7일, 30일, 90일)
 *   - id: string - Unique identifier
 *   - label: string - Display text
 *   - days: number - Number of days from today (0 = today only)
 * - monthsCount?: number - Number of months to show in monthly selector (optional, default: 12)
 * - placeholder?: string - Placeholder text (optional, default: "기간 선택")
 * - size?: "default" | "sm" - Trigger button size (optional, default: "default")
 * - align?: "start" | "center" | "end" - Popover alignment (optional, default: "end")
 *
 * @designTokens
 * - Uses Select for preset/month selection
 * - Uses Calendar with range mode for custom selection
 * - Uses Popover for calendar dropdown
 * - Uses text-label-l (14px) for trigger text
 * - Uses gap-2 between trigger icon and text
 *
 * @useCase
 * - Dashboard date filtering
 * - Report period selection
 * - Analytics time range picker
 * - Any data visualization requiring date filtering
 *
 * @example
 * ```tsx
 * // Basic usage with presets and monthly selection
 * const [period, setPeriod] = useState<DatePeriodValue>();
 *
 * <DatePeriodSelector
 *   value={period}
 *   onChange={setPeriod}
 * />
 *
 * // Custom presets and 24 months
 * <DatePeriodSelector
 *   value={period}
 *   onChange={setPeriod}
 *   presets={[
 *     { id: "7days", label: "최근 7일", days: 7 },
 *     { id: "30days", label: "최근 30일", days: 30 },
 *   ]}
 *   monthsCount={24}
 * />
 *
 * // Using the selected dates for GraphQL queries
 * const startDate = period?.from.toISOString();
 * const endDate = period?.to.toISOString();
 * ```
 */
export function DatePeriodSelector({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  monthsCount = 12,
  placeholder = "기간 선택",
  className,
  size = "default",
  align = "end",
}: DatePeriodSelectorProps): React.JSX.Element {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarRange, setCalendarRange] = useState<DateRange | undefined>();

  const monthOptions = useMemo(
    () => getMonthOptions(monthsCount),
    [monthsCount]
  );

  useEffect(() => {
    if (!value || !isValidDatePeriodValue(value)) {
      onChange(getDefaultDatePeriod());
    }
  }, []); // Run only on mount

  // Compute current select value
  const selectValue = useMemo(() => {
    if (!value) return undefined;
    if (value.type === "preset") {
      return `preset:${presets.find((p) => p.label === value.label)?.id || ""}`;
    }
    if (value.type === "month") {
      const monthId = `${value.from.getFullYear()}-${String(
        value.from.getMonth() + 1
      ).padStart(2, "0")}`;
      return `month:${monthId}`;
    }
    return undefined;
  }, [value, presets]);

  const handleSelectChange = (val: string) => {
    if (val === "custom") {
      setIsCalendarOpen(true);
      return;
    }

    const [type, id] = val.split(":");

    if (type === "preset") {
      const preset = presets.find((p) => p.id === id);
      if (preset) {
        const today = new Date();
        const to = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          23,
          59,
          59
        );
        const from = new Date(today);
        from.setDate(today.getDate() - preset.days);
        from.setHours(0, 0, 0, 0);

        onChange({
          type: "preset",
          from,
          to,
          label: preset.label,
        });
      }
    } else if (type === "month") {
      const monthOpt = monthOptions.find((m) => m.id === id);
      if (monthOpt) {
        onChange({
          type: "month",
          from: monthOpt.from,
          to: monthOpt.to,
          label: monthOpt.label,
        });
      }
    }
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    setCalendarRange(range);
  };

  const handleCalendarApply = () => {
    if (calendarRange?.from && calendarRange?.to) {
      const from = new Date(calendarRange.from);
      from.setHours(0, 0, 0, 0);
      const to = new Date(calendarRange.to);
      to.setHours(23, 59, 59, 999);

      onChange({
        type: "range",
        from,
        to,
        label: formatDateRange(from, to),
      });
      setIsCalendarOpen(false);
      setCalendarRange(undefined);
    }
  };

  const handleCalendarCancel = () => {
    setIsCalendarOpen(false);
    setCalendarRange(undefined);
  };

  const displayValue = value?.label || placeholder;

  const selectOptions = useMemo(() => {
    return [
      {
        value: "group:presets",
        label: "빠른 선택",
        disabled: true,
      },
      ...presets.map((p) => ({ value: `preset:${p.id}`, label: p.label })),
      {
        value: "sep:1",
        label: "-",
        disabled: true,
      },
      {
        value: "group:months",
        label: "월별 선택",
        disabled: true,
      },
      ...monthOptions.map((m) => ({ value: `month:${m.id}`, label: m.label })),
      {
        value: "sep:2",
        label: "-",
        disabled: true,
      },
      {
        value: "group:custom",
        label: "직접 선택",
        disabled: true,
      },
      { value: "custom", label: "날짜 범위 선택..." },
    ];
  }, [presets, monthOptions]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select
        value={selectValue}
        onValueChange={handleSelectChange}
        className="min-w-[160px]"
        size={size === "sm" ? "sm" : "md"}
        side={align === "start" ? "left" : "right"}
        placeholder={displayValue}
        options={selectOptions}
      />

      <Dialog open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <DialogContent className="w-auto max-w-fit p-6">
          <DialogHeader>
            <DialogTitle>날짜 범위 선택</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <DatePickerProvider
              type="range"
              rangeValue={
                calendarRange?.from && calendarRange?.to
                  ? { start: calendarRange.from, end: calendarRange.to }
                  : null
              }
              onRangeValueChange={(range) =>
                setCalendarRange(
                  range ? { from: range.start, to: range.end } : undefined
                )
              }
            >
              <DatePickerCalendar size="md" />
            </DatePickerProvider>
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
              <Button
                buttonStyle="secondary"
                size="sm"
                onClick={handleCalendarCancel}
              >
                취소
              </Button>
              <Button
                size="sm"
                onClick={handleCalendarApply}
                disabled={!calendarRange?.from || !calendarRange?.to}
              >
                적용
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Validates if a value is a valid DatePeriodValue
 */
function isValidDatePeriodValue(value: unknown): value is DatePeriodValue {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    (v.type === "preset" || v.type === "month" || v.type === "range") &&
    v.from instanceof Date &&
    !isNaN(v.from.getTime()) &&
    v.to instanceof Date &&
    !isNaN(v.to.getTime()) &&
    typeof v.label === "string"
  );
}

/**
 * @function getDateRangeFromPeriod
 * @description Utility function to extract ISO date strings from a DatePeriodValue.
 * Useful for constructing GraphQL query filters.
 *
 * @param period - The selected date period value
 * @returns Object with from and to ISO strings, or undefined dates if no period
 *
 * @example
 * ```tsx
 * const { from, to } = getDateRangeFromPeriod(selectedPeriod);
 * const query = aggregationQuery
 *   .replace(/"{{DATE_FROM}}"/g, `"${from}"`)
 *   .replace(/"{{DATE_TO}}"/g, `"${to}"`);
 * ```
 */
export function getDateRangeFromPeriod(period?: DatePeriodValue | unknown): {
  from: string;
  to: string;
} {
  // Validate period - if invalid, use default (최근 30일)
  if (!isValidDatePeriodValue(period)) {
    const defaultPeriod = getDefaultDatePeriod();
    return {
      from: defaultPeriod.from.toISOString(),
      to: defaultPeriod.to.toISOString(),
    };
  }

  return {
    from: period.from.toISOString(),
    to: period.to.toISOString(),
  };
}

/**
 * @function injectDateFilters
 * @description Replaces date placeholder tokens in GraphQL query strings with actual dates.
 *
 * @param queryTemplate - GraphQL query string with {{DATE_FROM}} and {{DATE_TO}} placeholders
 * @param period - The selected date period value (optional, defaults to last 30 days)
 * @returns Query string with dates injected
 *
 * @example
 * ```tsx
 * const query = injectDateFilters(graphqlQueries.aggregation_query, selectedPeriod);
 * const response = await apiClient.post(ENDPOINT, { query, variables: {} });
 * ```
 */
export function injectDateFilters(
  queryTemplate: string,
  period?: DatePeriodValue | unknown
): string {
  const { from, to } = getDateRangeFromPeriod(period);
  return queryTemplate
    .replace(/"{{DATE_FROM}}"/g, `"${from}"`)
    .replace(/"{{DATE_TO}}"/g, `"${to}"`);
}
