import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { isSameDay, isToday as isTodayFn, addMonths, subMonths, format } from "date-fns";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/commerce-sdk";
import { Label } from "@/components/ui/label";
import { useDatePickerContext, DatePickerProvider } from "./date-picker-context";
import type { DatePickerProviderProps } from "./date-picker-context";
import {
  generateCalendarDays,
  isDateDisabled,
  isDateInRange,
  isDateInDisplayMonth,
  formatDateForDisplay,
  parseUserInput,
  parseTimeInput,
  formatTime,
  getPresetRanges,
  getMonthOptions,
  getYearOptions,
} from "./date-picker-utils";

// ============================================================================
// CVA Variants
// ============================================================================

const datePickerFieldVariants = cva(
  "inline-flex items-center bg-background-0 gap-8 rounded-medium transition-all border w-full",
  {
    variants: {
      size: {
        sm: "h-32 px-10 py-6",
        md: "h-40 px-10 py-8",
      },
      error: {
        true: "border-border-error focus-within:ring-2 focus-within:ring-border-error",
        false: "border-border-200 focus-within:ring-2 focus-within:ring-border-brand hover:border-border-200-hover",
      },
      disabled: {
        true: "opacity-50 cursor-not-allowed bg-background-100",
        false: "cursor-pointer",
      },
    },
    defaultVariants: {
      size: "md",
      error: false,
      disabled: false,
    },
  }
);

const datePickerItemVariants = cva(
  "flex flex-col items-center justify-center text-caption-1 transition-all relative",
  {
    variants: {
      size: {
        sm: "h-32 w-32 text-caption-1",
        md: "h-40 w-40 text-caption-1",
      },
      state: {
        default: "text-text-secondary hover:bg-background-100 cursor-pointer rounded-medium font-normal",
        selected:
          "border-2 border-border-brand text-text-primary hover:bg-background-100 cursor-pointer rounded-medium",
        today: "text-text-brand cursor-pointer rounded-medium hover:bg-background-100 font-medium",
        disabled: "text-text-tertiary cursor-not-allowed opacity-50",
        outsideMonth: "text-text-tertiary hover:bg-background-100 cursor-pointer rounded-medium opacity-40",
        rangeStart:
          "border-2 border-border-brand text-text-primary hover:bg-background-100 cursor-pointer rounded-l-medium",
        rangeEnd:
          "border-2 border-border-brand text-text-primary hover:bg-background-100 cursor-pointer rounded-r-medium",
        inRange: "bg-background-brand-light text-text-primary cursor-pointer rounded-none",
      },
    },
    defaultVariants: {
      size: "md",
      state: "default",
    },
  }
);

const datePickerHeaderVariants = cva(
  "flex items-center p-12 border-b border-border-100",
  {
    variants: {
      variant: {
        "variant-a": "justify-between gap-8",
        "variant-b": "justify-between gap-8",
        "variant-c": "justify-between gap-8",
        "variant-d": "justify-between gap-8",
      },
    },
    defaultVariants: {
      variant: "variant-a",
    },
  }
);

const datePickerPresetVariants = cva(
  "flex items-center w-full px-12 py-8 rounded-medium text-label-2 transition-all cursor-pointer text-left",
  {
    variants: {
      selected: {
        true: "bg-background-brand-light text-text-brand font-medium",
        false: "text-text-primary hover:bg-background-100",
      },
    },
    defaultVariants: {
      selected: false,
    },
  }
);

// ============================================================================
// DatePickerItem
// ============================================================================

/**
 * DatePickerItem 컴포넌트 Props
 *
 * @property {Date} date - 표시할 날짜
 * @property {"sm" | "md"} size - 크기
 */
export interface DatePickerItemProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">,
    Omit<VariantProps<typeof datePickerItemVariants>, "state"> {
  date: Date;
}

/**
 * 개별 날짜 셀 컴포넌트
 *
 * 달력에서 하나의 날짜를 표시하며, 선택, 오늘, 비활성화, 범위 등의 상태를 시각적으로 나타냅니다.
 */
function DatePickerItem({ date, size, className, ...props }: DatePickerItemProps) {
  const {
    type,
    selectedDate,
    selectedRange,
    hoveredDate,
    displayMonth,
    minDate,
    maxDate,
    disabledDates,
    onDateSelect,
    onRangeSelect,
    onHoverDateChange,
    focusedDate,
    setFocusedDate,
    setIsOpen,
    rangeSelectionPhaseRef,
    indicator,
  } = useDatePickerContext();

  const isDisabled = isDateDisabled(date, minDate, maxDate, disabledDates);
  const isToday = isTodayFn(date);
  const isOutsideMonth = !isDateInDisplayMonth(date, displayMonth);
  const isFocused = focusedDate ? isSameDay(date, focusedDate) : false;

  // Single mode: check if selected
  const isSelected =
    type === "single" && selectedDate ? isSameDay(date, selectedDate) : false;

  // Range mode: check range states
  const isRangeStart =
    type === "range" && selectedRange?.start ? isSameDay(date, selectedRange.start) : false;
  const isRangeEnd =
    type === "range" && selectedRange?.end ? isSameDay(date, selectedRange.end) : false;
  const isInRange =
    type === "range" && selectedRange ? isDateInRange(date, selectedRange) : false;

  // Range hover preview (only show when waiting for second click)
  const isHoveredInRange =
    type === "range" &&
    rangeSelectionPhaseRef.current === "awaiting-end" &&
    selectedRange?.start &&
    hoveredDate
      ? isDateInRange(date, { start: selectedRange.start, end: hoveredDate })
      : false;

  // Determine visual state
  let state: "default" | "selected" | "today" | "disabled" | "outsideMonth" | "rangeStart" | "rangeEnd" | "inRange" = "default";

  if (isDisabled) {
    state = "disabled";
  } else if (isRangeStart) {
    state = "rangeStart";
  } else if (isRangeEnd) {
    state = "rangeEnd";
  } else if (isInRange || isHoveredInRange) {
    state = "inRange";
  } else if (isSelected) {
    state = "selected";
  } else if (isToday) {
    state = "today";
  } else if (isOutsideMonth) {
    state = "outsideMonth";
  }

  const handleClick = () => {
    if (isDisabled) return;

    if (type === "single") {
      console.log("[DatePickerItem] Single mode - selecting date:", date);
      onDateSelect(date);
      setIsOpen(false); // Close popover after selection
    } else if (type === "range") {
      console.log("[DatePickerItem] Range mode - clicked date:", date);
      console.log("[DatePickerItem] Current selectedRange:", selectedRange);
      console.log("[DatePickerItem] rangeSelectionPhaseRef.current:", rangeSelectionPhaseRef.current);

      // Use ref to determine if we're waiting for second click
      if (rangeSelectionPhaseRef.current === "idle") {
        // First click - start new range
        console.log("[DatePickerItem] First click (phase: idle) - starting new range");
        onRangeSelect({ start: date, end: date });
        // Note: ref will be updated to "awaiting-end" in handleRangeSelect
      } else if (rangeSelectionPhaseRef.current === "awaiting-end") {
        // Second click - complete range
        console.log("[DatePickerItem] Second click (phase: awaiting-end) - completing range");

        if (!selectedRange?.start) {
          // Shouldn't happen, but fallback
          console.log("[DatePickerItem] Warning: awaiting-end but no start date");
          onRangeSelect({ start: date, end: date });
        } else if (date < selectedRange.start) {
          // If clicked date is before start, swap them
          console.log("[DatePickerItem] Date before start, swapping");
          onRangeSelect({ start: date, end: selectedRange.start });
        } else if (isSameDay(date, selectedRange.start)) {
          // If clicked same date, just keep it as single date range
          console.log("[DatePickerItem] Same date clicked");
          onRangeSelect({ start: date, end: date });
        } else {
          // Normal case: end is after start
          console.log("[DatePickerItem] Normal case - end after start");
          onRangeSelect({ start: selectedRange.start, end: date });
        }
        setIsOpen(false); // Close popover after range complete
        // Note: ref will be updated to "idle" in handleRangeSelect
      }
    }
  };

  const handleMouseEnter = () => {
    if (type === "range" && rangeSelectionPhaseRef.current === "awaiting-end") {
      onHoverDateChange(date);
    }
  };

  const handleMouseLeave = () => {
    if (type === "range") {
      onHoverDateChange(null);
    }
  };

  const handleFocus = () => {
    setFocusedDate(date);
  };

  return (
    <button
      type="button"
      role="gridcell"
      aria-selected={isSelected || isRangeStart || isRangeEnd}
      aria-disabled={isDisabled}
      aria-label={format(date, "yyyy년 M월 d일")}
      tabIndex={isFocused ? 0 : -1}
      data-slot="date-picker-item"
      className={cn(datePickerItemVariants({ size, state }), className)}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      disabled={isDisabled}
      {...props}
    >
      <span>{date.getDate()}</span>
      {indicator && indicator(date)}
    </button>
  );
}

DatePickerItem.displayName = "DatePickerItem";

// ============================================================================
// DatePickerGrid
// ============================================================================

/**
 * DatePickerGrid 컴포넌트 Props
 *
 * @property {"sm" | "md"} size - 크기
 */
export interface DatePickerGridProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md";
}

/**
 * 달력 그리드 컴포넌트
 *
 * 요일 헤더와 날짜 셀들을 7x6 그리드로 표시합니다.
 */
function DatePickerGrid({ size = "md", className, ...props }: DatePickerGridProps) {
  const { displayMonth, locale } = useDatePickerContext();

  const days = generateCalendarDays(displayMonth, locale);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div
      role="grid"
      aria-label={`${format(displayMonth, "yyyy년 M월")} 달력`}
      data-slot="date-picker-grid"
      className={cn("p-12", className)}
      {...props}
    >
      {/* Weekday headers */}
      <div role="row" className="grid grid-cols-7 gap-4 mb-8">
        {weekdays.map((day) => (
          <div
            key={day}
            role="columnheader"
            className={cn(
              "flex items-center justify-center text-label-3 text-text-secondary font-medium",
              size === "sm" ? "h-32" : "h-40"
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7 gap-0">
        {days.map((date, index) => (
          <DatePickerItem key={index} date={date} size={size} />
        ))}
      </div>
    </div>
  );
}

DatePickerGrid.displayName = "DatePickerGrid";

// ============================================================================
// DatePickerHeader
// ============================================================================

/**
 * DatePickerHeader 컴포넌트 Props
 *
 * @property {"variant-a" | "variant-b" | "variant-c" | "variant-d"} variant - 헤더 스타일
 *   - `"variant-a"`: ← Month↓ Year↓ → (기본값)
 *   - `"variant-b"`: ← Month Year↓ →
 *   - `"variant-c"`: Month↓ Year↓ ← →
 *   - `"variant-d"`: Month Year↓ ← →
 */
export interface DatePickerHeaderProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof datePickerHeaderVariants> {}

/**
 * 달력 헤더 컴포넌트
 *
 * 월/연도 네비게이션과 표시를 담당합니다. 4가지 레이아웃 변형을 지원합니다.
 */
function DatePickerHeader({
  variant = "variant-a",
  className,
  ...props
}: DatePickerHeaderProps) {
  const { displayMonth, onMonthChange, locale } = useDatePickerContext();

  const currentMonth = displayMonth.getMonth();
  const currentYear = displayMonth.getFullYear();

  const monthOptions = getMonthOptions(locale);
  const yearOptions = getYearOptions(currentYear);

  const handlePrevMonth = () => {
    onMonthChange(subMonths(displayMonth, 1));
  };

  const handleNextMonth = () => {
    onMonthChange(addMonths(displayMonth, 1));
  };

  const handleMonthChange = (month: number) => {
    const newDate = new Date(displayMonth);
    newDate.setMonth(month);
    onMonthChange(newDate);
  };

  const handleYearChange = (year: number) => {
    const newDate = new Date(displayMonth);
    newDate.setFullYear(year);
    onMonthChange(newDate);
  };

  // Simple dropdown component (inline for now)
  const MonthSelect = () => (
    <select
      value={currentMonth}
      onChange={(e) => handleMonthChange(Number(e.target.value))}
      className="px-8 py-4 rounded-small border border-border-200 text-label-2 text-text-primary hover:border-border-200-hover focus:outline-none focus:ring-2 focus:ring-border-brand bg-background-0"
      aria-label="월 선택"
    >
      {monthOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );

  const YearSelect = () => (
    <select
      value={currentYear}
      onChange={(e) => handleYearChange(Number(e.target.value))}
      className="px-8 py-4 rounded-small border border-border-200 text-label-2 text-text-primary hover:border-border-200-hover focus:outline-none focus:ring-2 focus:ring-border-brand bg-background-0"
      aria-label="연도 선택"
    >
      {yearOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );

  const MonthYearDisplay = () => (
    <span className="text-label-1 text-text-primary font-semibold">
      {format(displayMonth, "yyyy년 M월", { locale })}
    </span>
  );

  const NavButton = ({
    direction,
    onClick,
  }: {
    direction: "prev" | "next";
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "prev" ? "이전 달" : "다음 달"}
      className="p-4 rounded-small hover:bg-background-100 transition-all text-icon-secondary hover:text-icon-primary"
    >
      {direction === "prev" ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
    </button>
  );

  return (
    <div
      data-slot="date-picker-header"
      className={cn(datePickerHeaderVariants({ variant }), className)}
      {...props}
    >
      {/* Variant A: ← Month↓ Year↓ → */}
      {variant === "variant-a" && (
        <>
          <NavButton direction="prev" onClick={handlePrevMonth} />
          <div className="flex items-center gap-8">
            <MonthSelect />
            <YearSelect />
          </div>
          <NavButton direction="next" onClick={handleNextMonth} />
        </>
      )}

      {/* Variant B: ← Month Year↓ → */}
      {variant === "variant-b" && (
        <>
          <NavButton direction="prev" onClick={handlePrevMonth} />
          <div className="flex items-center gap-8">
            <MonthYearDisplay />
            <YearSelect />
          </div>
          <NavButton direction="next" onClick={handleNextMonth} />
        </>
      )}

      {/* Variant C: Month↓ Year↓ ← → */}
      {variant === "variant-c" && (
        <>
          <div className="flex items-center gap-8">
            <MonthSelect />
            <YearSelect />
          </div>
          <div className="flex items-center gap-4">
            <NavButton direction="prev" onClick={handlePrevMonth} />
            <NavButton direction="next" onClick={handleNextMonth} />
          </div>
        </>
      )}

      {/* Variant D: Month Year↓ ← → */}
      {variant === "variant-d" && (
        <>
          <div className="flex items-center gap-8">
            <MonthYearDisplay />
            <YearSelect />
          </div>
          <div className="flex items-center gap-4">
            <NavButton direction="prev" onClick={handlePrevMonth} />
            <NavButton direction="next" onClick={handleNextMonth} />
          </div>
        </>
      )}
    </div>
  );
}

DatePickerHeader.displayName = "DatePickerHeader";

// ============================================================================
// DatePickerCalendar
// ============================================================================

/**
 * DatePickerCalendar 컴포넌트 Props
 *
 * @property {"variant-a" | "variant-b" | "variant-c" | "variant-d"} headerVariant - 헤더 스타일
 * @property {"sm" | "md"} size - 크기
 */
export interface DatePickerCalendarProps extends React.HTMLAttributes<HTMLDivElement> {
  headerVariant?: "variant-a" | "variant-b" | "variant-c" | "variant-d";
  size?: "sm" | "md";
}

/**
 * 달력 컴포넌트
 *
 * 헤더와 그리드를 결합한 완전한 달력 UI입니다.
 */
function DatePickerCalendar({
  headerVariant = "variant-a",
  size = "md",
  className,
  ...props
}: DatePickerCalendarProps) {
  return (
    <div
      data-slot="date-picker-calendar"
      className={cn("bg-background-0 rounded-large border border-border-100", className)}
      {...props}
    >
      <DatePickerHeader variant={headerVariant} />
      <DatePickerGrid size={size} />
    </div>
  );
}

DatePickerCalendar.displayName = "DatePickerCalendar";

// ============================================================================
// DatePickerPresets
// ============================================================================

/**
 * DatePickerPresets 컴포넌트 Props
 */
export interface DatePickerPresetsProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * 범위 프리셋 사이드바 컴포넌트
 *
 * "오늘", "최근 7일" 등의 빠른 범위 선택 버튼을 제공합니다. (range 모드 전용)
 */
function DatePickerPresets({ className, ...props }: DatePickerPresetsProps) {
  const { selectedRange, onRangeSelect, onMonthChange } = useDatePickerContext();

  const presets = getPresetRanges();

  const handlePresetClick = (preset: typeof presets[0]) => {
    const range = preset.getValue();
    onRangeSelect(range);
    onMonthChange(range.start);
  };

  return (
    <div
      data-slot="date-picker-presets"
      className={cn(
        "flex flex-col gap-4 p-12 border-r border-border-100 min-w-[140px]",
        className
      )}
      {...props}
    >
      <span className="text-label-3 text-text-secondary font-medium mb-4">Custom Range</span>
      {presets.map((preset) => {
        const isSelected =
          selectedRange &&
          isSameDay(selectedRange.start, preset.getValue().start) &&
          isSameDay(selectedRange.end, preset.getValue().end);

        return (
          <button
            key={preset.label}
            type="button"
            onClick={() => handlePresetClick(preset)}
            className={cn(datePickerPresetVariants({ selected: !!isSelected }))}
          >
            {preset.labelKo}
          </button>
        );
      })}
    </div>
  );
}

DatePickerPresets.displayName = "DatePickerPresets";

// ============================================================================
// DatePickerTimePicker
// ============================================================================

/**
 * DatePickerTimePicker 컴포넌트 Props
 */
export interface DatePickerTimePickerProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * 시간 입력 컴포넌트
 *
 * HH:mm 형식으로 시간을 입력받습니다.
 */
function DatePickerTimePicker({ className, ...props }: DatePickerTimePickerProps) {
  const { selectedTime, onTimeChange } = useDatePickerContext();

  const [timeInput, setTimeInput] = React.useState(
    selectedTime ? formatTime(selectedTime) : ""
  );
  const [error, setError] = React.useState(false);

  const handleTimeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTimeInput(value);

    const parsed = parseTimeInput(value);
    if (parsed) {
      onTimeChange(parsed);
      setError(false);
    } else if (value.length >= 5) {
      setError(true);
    }
  };

  return (
    <div
      data-slot="date-picker-time-picker"
      className={cn("p-12 border-t border-border-100", className)}
      {...props}
    >
      <div className="flex items-center gap-8">
        <span className="text-label-2 text-text-secondary">시간</span>
        <input
          type="text"
          value={timeInput}
          onChange={handleTimeInputChange}
          placeholder="00:00"
          className={cn(
            "px-8 py-4 rounded-small border text-label-2 text-text-primary focus:outline-none focus:ring-2 bg-background-0 w-80",
            error
              ? "border-border-error focus:ring-border-error"
              : "border-border-200 focus:ring-border-brand"
          )}
          aria-label="시간 입력"
          aria-invalid={error}
        />
        {error && (
          <span className="text-label-3 text-text-error">올바른 형식이 아닙니다 (HH:mm)</span>
        )}
      </div>
    </div>
  );
}

DatePickerTimePicker.displayName = "DatePickerTimePicker";

// ============================================================================
// DatePickerField
// ============================================================================

/**
 * DatePickerField 컴포넌트 Props
 *
 * @property {string} label - 레이블 텍스트
 * @property {string} placeholder - 플레이스홀더 텍스트
 * @property {boolean} error - 에러 상태
 * @property {string} helperText - 도움말 텍스트
 * @property {boolean} disabled - 비활성화 여부
 * @property {"sm" | "md"} size - 크기
 */
export interface DatePickerFieldProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children">,
    Omit<VariantProps<typeof datePickerFieldVariants>, "error" | "disabled"> {
  label?: string;
  placeholder?: string;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
}

/**
 * 날짜 입력 필드 컴포넌트
 *
 * 레이블, 입력 필드, 달력 트리거 버튼을 포함합니다.
 * 사용자가 직접 입력하거나 달력에서 선택할 수 있습니다.
 */
const DatePickerField = React.forwardRef<HTMLDivElement, DatePickerFieldProps>(
  (
    {
      label,
      error = false,
      helperText,
      disabled = false,
      size = "md",
      className,
      ...props
    },
    ref
  ) => {
    const {
      type,
      selectedDate,
      selectedRange,
      selectedTime,
      hasTimePicker,
      isOpen,
      setIsOpen,
      onDateSelect,
      onRangeSelect,
      onMonthChange,
      locale,
    } = useDatePickerContext();

    const [startDateInput, setStartDateInput] = React.useState("");
    const [endDateInput, setEndDateInput] = React.useState("");
    const [startTimeInput, setStartTimeInput] = React.useState("");
    const [endTimeInput, setEndTimeInput] = React.useState("");

    // Update input values when selection changes
    React.useEffect(() => {
      if (type === "single" && selectedDate) {
        setStartDateInput(formatDateForDisplay(selectedDate, "yyyy/MM/dd", locale));
        if (hasTimePicker && selectedTime) {
          setStartTimeInput(formatTime(selectedTime));
        }
      } else if (type === "range" && selectedRange) {
        setStartDateInput(formatDateForDisplay(selectedRange.start, "yyyy/MM/dd", locale));
        setEndDateInput(formatDateForDisplay(selectedRange.end, "yyyy/MM/dd", locale));
      } else {
        setStartDateInput("");
        setEndDateInput("");
        setStartTimeInput("");
        setEndTimeInput("");
      }
    }, [type, selectedDate, selectedRange, selectedTime, hasTimePicker, locale]);

    const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setStartDateInput(value);

      if (type === "single") {
        const parsed = parseUserInput(value, "yyyy/MM/dd", locale);
        if (parsed) {
          onDateSelect(parsed);
          onMonthChange(parsed);
        }
      } else if (type === "range") {
        const parsed = parseUserInput(value, "yyyy/MM/dd", locale);
        if (parsed && selectedRange) {
          onRangeSelect({ start: parsed, end: selectedRange.end });
        }
      }
    };

    const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setEndDateInput(value);

      if (type === "range") {
        const parsed = parseUserInput(value, "yyyy/MM/dd", locale);
        if (parsed && selectedRange) {
          onRangeSelect({ start: selectedRange.start, end: parsed });
        }
      }
    };

    const handleClear = () => {
      setStartDateInput("");
      setEndDateInput("");
      setStartTimeInput("");
      setEndTimeInput("");
      if (type === "single") {
        onDateSelect(null);
      }
      // Range mode: just clear the inputs, don't call onRangeSelect with null
    };

    const fieldId = React.useId();
    const hasValue = type === "single" ? startDateInput : (startDateInput || endDateInput);

    return (
      <div ref={ref} className={cn("flex flex-col gap-6", className)} {...props}>
        {label && (
          <Label htmlFor={fieldId} className="text-label-2 text-text-primary">
            {label}
          </Label>
        )}

        <div className="flex items-center gap-8">
          {/* Date Input(s) */}
          <div
            data-slot="date-picker-field"
            className={cn(datePickerFieldVariants({ size, error, disabled }), "flex-1")}
          >
            <button
              type="button"
              onClick={() => !disabled && setIsOpen(!isOpen)}
              disabled={disabled}
              className="shrink-0 p-0 bg-transparent border-0 cursor-pointer disabled:cursor-not-allowed"
              aria-label="달력 열기"
            >
              <Calendar
                size={size === "sm" ? 14 : 16}
                className="text-icon-secondary"
              />
            </button>

            {/* Single mode: one date input */}
            {type === "single" && (
              <input
                id={fieldId}
                type="text"
                value={startDateInput}
                onChange={handleStartDateChange}
                onClick={(e) => e.stopPropagation()}
                onFocus={() => !disabled && setIsOpen(true)}
                placeholder="yyyy/mm/dd"
                disabled={disabled}
                className="flex-1 bg-transparent outline-none text-label-2 text-text-primary placeholder:text-text-tertiary min-w-0"
                aria-label={label || "날짜 입력"}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
              />
            )}

            {/* Range mode: two date inputs */}
            {type === "range" && (
              <>
                <input
                  id={fieldId}
                  type="text"
                  value={startDateInput}
                  onChange={handleStartDateChange}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={() => !disabled && setIsOpen(true)}
                  placeholder="yyyy/mm/dd"
                  disabled={disabled}
                  className="flex-1 bg-transparent outline-none text-label-2 text-text-primary placeholder:text-text-tertiary min-w-0"
                  aria-label="시작 날짜"
                  aria-expanded={isOpen}
                  aria-haspopup="dialog"
                />
                <span className="text-text-tertiary">-</span>
                <input
                  type="text"
                  value={endDateInput}
                  onChange={handleEndDateChange}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={() => !disabled && setIsOpen(true)}
                  placeholder="yyyy/mm/dd"
                  disabled={disabled}
                  className="flex-1 bg-transparent outline-none text-label-2 text-text-primary placeholder:text-text-tertiary min-w-0"
                  aria-label="종료 날짜"
                />
              </>
            )}

            {hasValue && !disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="text-icon-secondary hover:text-icon-primary transition-colors shrink-0"
                aria-label="날짜 지우기"
              >
                <X size={size === "sm" ? 14 : 16} />
              </button>
            )}
          </div>

          {/* Time Input(s) - only for single mode with timePicker */}
          {type === "single" && hasTimePicker && (
            <div
              className={cn(datePickerFieldVariants({ size, error, disabled }), "w-80")}
            >
              <input
                type="text"
                value={startTimeInput}
                onChange={(e) => setStartTimeInput(e.target.value)}
                placeholder="00:00"
                disabled={disabled}
                className="w-full bg-transparent outline-none text-label-2 text-text-primary placeholder:text-text-tertiary text-center"
                aria-label="시간 입력"
              />
            </div>
          )}

          {/* Time Inputs - for range mode with timePicker */}
          {type === "range" && hasTimePicker && (
            <>
              <div
                className={cn(datePickerFieldVariants({ size, error, disabled }), "w-80")}
              >
                <input
                  type="text"
                  value={startTimeInput}
                  onChange={(e) => setStartTimeInput(e.target.value)}
                  placeholder="00:00"
                  disabled={disabled}
                  className="w-full bg-transparent outline-none text-label-2 text-text-primary placeholder:text-text-tertiary text-center"
                  aria-label="시작 시간"
                />
              </div>
              <div
                className={cn(datePickerFieldVariants({ size, error, disabled }), "w-80")}
              >
                <input
                  type="text"
                  value={endTimeInput}
                  onChange={(e) => setEndTimeInput(e.target.value)}
                  placeholder="00:00"
                  disabled={disabled}
                  className="w-full bg-transparent outline-none text-label-2 text-text-primary placeholder:text-text-tertiary text-center"
                  aria-label="종료 시간"
                />
              </div>
            </>
          )}
        </div>

        {helperText && (
          <span
            className={cn(
              "text-label-3",
              error ? "text-text-error" : "text-text-secondary"
            )}
          >
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

DatePickerField.displayName = "DatePickerField";

// ============================================================================
// DatePickerPopover
// ============================================================================

/**
 * DatePickerPopover 컴포넌트 Props
 *
 * @property {"variant-a" | "variant-b" | "variant-c" | "variant-d"} headerVariant - 헤더 스타일
 * @property {boolean} showPresets - 프리셋 사이드바 표시 여부 (range 모드 전용)
 * @property {"sm" | "md"} size - 크기
 */
export interface DatePickerPopoverProps extends React.HTMLAttributes<HTMLDivElement> {
  headerVariant?: "variant-a" | "variant-b" | "variant-c" | "variant-d";
  showPresets?: boolean;
  size?: "sm" | "md";
}

/**
 * 달력 팝오버 컴포넌트
 *
 * 달력, 프리셋, 시간 선택기를 포함하는 팝업 컨테이너입니다.
 */
function DatePickerPopover({
  headerVariant = "variant-a",
  showPresets = false,
  size = "md",
  className,
  children,
  ...props
}: DatePickerPopoverProps) {
  const { type, hasTimePicker, isOpen, setIsOpen } = useDatePickerContext();

  const showPresetsPanel = showPresets && type === "range";

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <PopoverPrimitive.Trigger asChild>{children}</PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-slot="date-picker-popover"
          role="dialog"
          aria-modal="true"
          aria-label="달력"
          className={cn(
            "z-50 rounded-large bg-background-0 shadow-lg border border-border-100",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            className
          )}
          sideOffset={8}
          align="start"
          {...props}
        >
          <div className="flex">
            {showPresetsPanel && <DatePickerPresets />}
            <div className="flex flex-col">
              <DatePickerCalendar headerVariant={headerVariant} size={size} />
              {hasTimePicker && <DatePickerTimePicker />}
            </div>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

DatePickerPopover.displayName = "DatePickerPopover";

// ============================================================================
// DatePicker (Root Component)
// ============================================================================

/**
 * DatePicker 컴포넌트 Props
 *
 * @property {"single" | "range"} type - 선택 모드
 *   - `"single"`: 단일 날짜 선택 (기본값)
 *   - `"range"`: 날짜 범위 선택
 *
 * @property {Date | null} value - 현재 선택된 날짜 (제어 컴포넌트, single 모드)
 * @property {Date | null} defaultValue - 초기 날짜 (비제어 컴포넌트, single 모드)
 * @property {function} onValueChange - 날짜 변경 콜백 (single 모드)
 *
 * @property {DateRange | null} rangeValue - 현재 선택된 범위 (제어 컴포넌트, range 모드)
 * @property {DateRange | null} defaultRangeValue - 초기 범위 (비제어 컴포넌트, range 모드)
 * @property {function} onRangeValueChange - 범위 변경 콜백 (range 모드)
 *
 * @property {boolean} timePicker - 시간 선택기 표시 여부 (기본값: false)
 *
 * @property {"date" | "iso" | "custom"} formatType - 출력 형식
 *   - `"date"`: JavaScript Date 객체 (기본값)
 *   - `"iso"`: ISO 8601 문자열
 *   - `"custom"`: 사용자 지정 형식
 * @property {string} customFormat - 사용자 지정 date-fns 형식 문자열
 *
 * @property {Date} minDate - 선택 가능한 최소 날짜
 * @property {Date} maxDate - 선택 가능한 최대 날짜
 * @property {Date[] | function} disabledDates - 비활성화할 날짜들
 *
 * @property {"variant-a" | "variant-b" | "variant-c" | "variant-d"} headerVariant - 헤더 스타일
 * @property {boolean} showPresets - 범위 프리셋 표시 여부 (range 모드 전용)
 * @property {Locale} locale - date-fns 로케일 (기본값: ko)
 * @property {"sm" | "md"} size - 크기 (기본값: md)
 *
 * @property {string} label - 레이블 텍스트
 * @property {string} placeholder - 플레이스홀더 텍스트
 * @property {boolean} disabled - 비활성화 여부
 * @property {boolean} error - 에러 상태
 * @property {string} helperText - 도움말 텍스트
 *
 * @example
 * ```tsx
 * // 단일 날짜 선택
 * <DatePicker
 *   type="single"
 *   label="출발 날짜"
 *   onValueChange={(date) => console.log(date)}
 * />
 *
 * // 날짜 범위 선택 + 프리셋
 * <DatePicker
 *   type="range"
 *   showPresets
 *   label="기간 선택"
 *   onRangeValueChange={(range) => console.log(range)}
 * />
 *
 * // 날짜 + 시간 선택
 * <DatePicker
 *   type="single"
 *   timePicker
 *   formatType="iso"
 *   label="예약 시간"
 *   onValueChange={(isoString) => console.log(isoString)}
 * />
 * ```
 */
export interface DatePickerProps
  extends Omit<DatePickerProviderProps, "children">,
    Omit<DatePickerFieldProps, "size" | "placeholder" | "defaultValue"> {
  headerVariant?: "variant-a" | "variant-b" | "variant-c" | "variant-d";
  showPresets?: boolean;
  size?: "sm" | "md";
  placeholder?: string;
}

/**
 * 사용자가 오타 없이 정확한 날짜나 기간을 선택할 수 있도록 돕는 달력 형태의 입력 도구
 *
 * 단일 날짜 선택과 날짜 범위 선택을 지원하며, 선택적으로 시간 입력도 가능합니다.
 * 사용자는 직접 입력하거나 달력에서 선택할 수 있습니다.
 *
 * **주요 기능:**
 * - 단일/범위 선택 모드
 * - 4가지 헤더 스타일 변형
 * - 빠른 범위 선택 프리셋
 * - 시간 입력 (선택)
 * - 다양한 출력 형식 (Date, ISO, Custom)
 * - 날짜 제약 조건 (min/max, disabled dates)
 * - 완전한 키보드 네비게이션
 * - 접근성 지원 (ARIA 속성)
 */
const DatePicker = React.forwardRef<HTMLDivElement, DatePickerProps>(
  (
    {
      // Provider props
      type = "single",
      value,
      defaultValue,
      onValueChange,
      rangeValue,
      defaultRangeValue,
      onRangeValueChange,
      timePicker = false,
      minDate,
      maxDate,
      disabledDates,
      locale,
      formatType = "date",
      customFormat,
      indicator,

      // UI props
      headerVariant = "variant-a",
      showPresets = false,
      size = "md",

      // Field props
      label,
      placeholder,
      disabled = false,
      error = false,
      helperText,

      className,
      ...props
    },
    ref
  ) => {
    return (
      <DatePickerProvider
        type={type}
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        rangeValue={rangeValue}
        defaultRangeValue={defaultRangeValue}
        onRangeValueChange={onRangeValueChange}
        timePicker={timePicker}
        minDate={minDate}
        maxDate={maxDate}
        disabledDates={disabledDates}
        locale={locale}
        formatType={formatType}
        customFormat={customFormat}
        indicator={indicator}
      >
        <DatePickerPopover
          headerVariant={headerVariant}
          showPresets={showPresets}
          size={size}
        >
          <DatePickerField
            ref={ref}
            label={label}
            placeholder={placeholder}
            disabled={disabled}
            error={error}
            helperText={helperText}
            size={size}
            className={className}
            {...props}
          />
        </DatePickerPopover>
      </DatePickerProvider>
    );
  }
);

DatePicker.displayName = "DatePicker";

// ============================================================================
// Exports
// ============================================================================

export {
  DatePicker,
  DatePickerField,
  DatePickerItem,
  DatePickerGrid,
  DatePickerHeader,
  DatePickerCalendar,
  DatePickerPresets,
  DatePickerTimePicker,
  DatePickerPopover,
};
