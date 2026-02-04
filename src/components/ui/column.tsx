/**
 * @fileoverview Column cell renderer components for DataTable.
 * Provides formatted display for various data types including text, numbers,
 * currency, dates, percentages, and status indicators.
 *
 * @module ui/column
 */

import React from "react";
import { format as formatDate } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Info,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn, parseArrayString } from "@/lib/commerce-sdk";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

type ColumnNoneProps = {
  className?: string;
};

/**
 * @component ColumnNone
 * @description Displays a dash placeholder for null/empty values.
 *
 * @dataStructure
 * - className?: string - Additional CSS classes
 *
 * @useCase
 * - Empty cell placeholder in tables
 * - Fallback for missing data
 */
function ColumnNone({ className }: ColumnNoneProps): React.JSX.Element {
  return <div className={className}>-</div>;
}

type ColumnValueProps = {
  className?: string;
  value: string | number | null;
};

/**
 * @component ColumnValue
 * @description Displays text/string values with truncation and tooltip on overflow.
 * Supports Markdown rendering for formatted text.
 *
 * @dataStructure
 * - value: string | number | null - Value to display (required)
 * - className?: string - Additional CSS classes
 *
 * @useCase
 * - General text column cells
 * - Names, descriptions, identifiers
 * - Markdown-formatted content
 */
function ColumnValue({
  className,
  value,
}: ColumnValueProps): React.JSX.Element {
  const [isTruncated, setIsTruncated] = React.useState(false);
  const textRef = React.useRef<HTMLSpanElement>(null);

  const checkTruncation = React.useCallback(() => {
    if (textRef.current) {
      setIsTruncated(textRef.current.scrollWidth > textRef.current.clientWidth);
    }
  }, []);

  React.useEffect(() => {
    checkTruncation();
    window.addEventListener("resize", checkTruncation);
    return () => window.removeEventListener("resize", checkTruncation);
  }, [value, checkTruncation]);

  if (value === null || value === undefined) {
    return <ColumnNone className={className} />;
  }

  const stringValue =
    typeof value === "number" ? value.toLocaleString("en-US") : value;

  if (stringValue.trim() === "") {
    return <ColumnNone className={className} />;
  }

  const parsed = parseArrayString(stringValue);
  const displayValue = parsed ? parsed.join(", ") : stringValue;

  if (!displayValue || displayValue.trim() === "") {
    return <ColumnNone className={className} />;
  }

  const maybeMarkdown =
    typeof displayValue === "string" &&
    /\*\*|__|`|~~|\[.+\]\(.+\)/.test(displayValue);

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            ref={textRef}
            className={cn(
              "block max-w-full overflow-hidden text-ellipsis whitespace-nowrap",
              className
            )}
          >
            {maybeMarkdown ? (
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <span>{children}</span>,
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      className="text-blue-500 underline"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {displayValue}
              </Markdown>
            ) : (
              displayValue
            )}
          </span>
        </TooltipTrigger>
        {isTruncated && (
          <TooltipContent side="top" align="start">
            {maybeMarkdown ? (
              <div className="max-w-sm">
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        className="text-blue-500 underline"
                      >
                        {children}
                      </a>
                    ),
                  }}
                >
                  {displayValue}
                </Markdown>
              </div>
            ) : (
              <span>{displayValue}</span>
            )}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

function ColumnDescription({
  className,
  value,
}: ColumnValueProps): React.JSX.Element {
  if (value === null || value === undefined) {
    return <ColumnNone className={className} />;
  }

  const stringValue =
    typeof value === "number" ? value.toLocaleString("en-US") : value;

  if (stringValue.trim() === "") {
    return <ColumnNone className={className} />;
  }

  const parsed = parseArrayString(stringValue);
  const displayValue = parsed ? parsed.join(", ") : stringValue;

  if (!displayValue || displayValue.trim() === "") {
    return <ColumnNone className={className} />;
  }

  return <p className={cn("block max-w-full", className)}>{displayValue}</p>;
}

type ColumnDateProps = {
  format?: string;
  value: string;
  isTime?: boolean;
  isMinute?: boolean;
  className?: string;
};

/**
 * @component ColumnDate
 * @description Formats and displays date/datetime values in KST timezone.
 *
 * @dataStructure
 * - value: string - ISO date string (required)
 * - format?: string - date-fns format string (default: "yy.MM.dd")
 * - isTime?: boolean - Include time display
 * - isMinute?: boolean - Show minutes (HH:mm) vs hours only
 * - className?: string - Additional CSS classes
 *
 * @useCase
 * - Created/updated timestamps
 * - Order dates
 * - Event times
 */
function ColumnDate({
  format = "yy.MM.dd",
  value,
  isTime = false,
  isMinute = false,
  className,
}: ColumnDateProps): React.JSX.Element {
  let dateObj: Date;
  try {
    dateObj = new Date(value);
    if (isNaN(dateObj.getTime())) {
      dateObj = new Date(value + "Z");
    }
  } catch {
    return <ColumnNone className={className} />;
  }

  const kstDate = toZonedTime(dateObj, "Asia/Seoul");
  let formattedDate = formatDate(kstDate, format);

  if (isTime) {
    if (isMinute) {
      formattedDate += ` ${formatDate(kstDate, "HH:mm")}`;
    } else {
      formattedDate += ` ${formatDate(kstDate, "HH")}시`;
    }
  }

  return (
    <div
      className={cn(
        "w-full overflow-hidden text-ellipsis whitespace-nowrap",
        isMinute && "text-xs",
        className
      )}
    >
      {formattedDate}
    </div>
  );
}

type ColumnNumberProps = {
  value: number;
  className?: string;
  unit?: string;
};

/**
 * @component ColumnNumber
 * @description Displays formatted numbers with locale-aware thousand separators.
 *
 * @dataStructure
 * - value: number - Numeric value (required)
 * - unit?: string - Unit suffix (e.g., "개", "명")
 * - className?: string - Additional CSS classes
 *
 * @useCase
 * - Quantities, counts
 * - Numeric metrics
 * - Right-aligned number columns
 */
function ColumnNumber({
  value,
  className,
  unit,
}: ColumnNumberProps): React.JSX.Element {
  if (!value) {
    return <ColumnNone className={cn("text-right", className)} />;
  }
  return (
    <div className={cn("text-right", className)}>
      {new Intl.NumberFormat("ko-KR").format(value)}
      {unit}
    </div>
  );
}

type ColumnPercentageProps = {
  value: number;
  className?: string;
};

/**
 * @component ColumnPercentage
 * @description Displays percentage values with automatic conversion and formatting.
 * Values > 1 are treated as already percentage, values <= 1 are multiplied by 100.
 *
 * @dataStructure
 * - value: number - Percentage value (0.5 or 50 both work)
 * - className?: string - Additional CSS classes
 *
 * @useCase
 * - Conversion rates
 * - Growth percentages
 * - Completion rates
 */
function ColumnPercentage({
  value,
  className,
}: ColumnPercentageProps): React.JSX.Element {
  if (!value) {
    return <ColumnNone className={cn("text-right", className)} />;
  }

  const percentage = value > 1 ? value : value * 100;
  const formatted = `${new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 1,
  }).format(percentage)}%`;

  return <div className={cn(className, "text-right")}>{formatted}</div>;
}

type ColumnPriceProps = {
  value: number | null;
  className?: string;
  style?:
    | keyof {
        decimal: never;
        percent: never;
        currency: never;
      }
    | undefined;
  currency?: string | undefined;
};

/**
 * @component ColumnPrice
 * @description Displays currency-formatted values with locale-aware formatting.
 *
 * @dataStructure
 * - value: number | null - Monetary value (required)
 * - currency?: string - Currency code (default: "KRW")
 * - style?: "decimal" | "percent" | "currency" - Number format style
 * - className?: string - Additional CSS classes
 *
 * @useCase
 * - Product prices
 * - Order totals
 * - Revenue figures
 */
function ColumnPrice({
  value,
  className,
  style = "currency",
  currency = "KRW",
}: ColumnPriceProps): React.JSX.Element {
  if (!value) {
    return <ColumnNone className="text-right" />;
  }
  return (
    <div className={cn(className, "text-right")}>
      {new Intl.NumberFormat("ko-KR", {
        style,
        currency,
      }).format(value)}
    </div>
  );
}

type ColumnArrowPriceProps = {
  value: number;
};

/**
 * @component ColumnArrowPrice
 * @description Displays price changes with directional arrows and color coding.
 * Positive values show up arrow, negative show down arrow with red color.
 *
 * @dataStructure
 * - value: number - Change amount (positive or negative)
 *
 * @useCase
 * - Price changes
 * - Stock movements
 * - Period-over-period differences
 */
function ColumnArrowPrice({ value }: ColumnArrowPriceProps): React.JSX.Element {
  const absValue = Math.abs(value);
  const formattedValue = new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 0,
  }).format(absValue);
  if (value > 0) {
    return (
      <div className="flex items-center gap-2 justify-end">
        <ArrowUp size={16} />
        <span className="text-right">+{formattedValue}</span>
      </div>
    );
  } else if (value < 0) {
    return (
      <div className="text-red-500 flex items-center gap-2 justify-end">
        <ArrowDown size={16} />
        <span className="text-right">-{formattedValue}</span>
      </div>
    );
  } else {
    return <ColumnNone />;
  }
}

type ColumnCheckStatusProps = {
  status: boolean | null;
};

/**
 * @component ColumnCheckStatus
 * @description Displays boolean status as check/alert icons.
 * True shows green checkmark, false shows red alert, null shows skip indicator.
 *
 * @dataStructure
 * - status: boolean | null - Status value
 *   - true: Green checkmark
 *   - false: Red alert circle
 *   - null: Gray "Skip" with tooltip
 *
 * @useCase
 * - Validation status
 * - Compliance checks
 * - Feature availability
 */
function ColumnCheckStatus({
  status,
}: ColumnCheckStatusProps): React.JSX.Element {
  if (status === null) {
    return (
      <div className="flex justify-center items-center">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="flex items-center text-muted-foreground gap-1">
                <span className="text-xs">Skip</span>
                <Info size={12} />
              </p>
            </TooltipTrigger>
            <TooltipContent>
              개인정보 처리 검사는 현재 네이버 플랫폼만 지원합니다.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }
  if (!status) {
    return (
      <div className="flex justify-center items-center">
        <AlertCircle size={24} className="text-red-600" />
      </div>
    );
  }
  return (
    <div className="flex justify-center items-center">
      <CheckCircle2 size={24} className="text-[#2a9d90]" />
    </div>
  );
}

export {
  ColumnNone,
  ColumnValue,
  ColumnDescription,
  ColumnDate,
  ColumnNumber,
  ColumnPercentage,
  ColumnPrice,
  ColumnArrowPrice,
  ColumnCheckStatus,
};
