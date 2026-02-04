import * as React from "react";
import type { Locale } from "date-fns";
import { isSameDay } from "date-fns";
import { ko } from "date-fns/locale";
import type { DatePickerContextValue, DateRange, TimeValue } from "./date-picker-types";
import { formatDateOutput } from "./date-picker-utils";

/**
 * DatePicker Context
 *
 * 모든 하위 컴포넌트에서 날짜 선택 상태와 콜백 함수에 접근할 수 있도록 합니다.
 */
const DatePickerContext = React.createContext<DatePickerContextValue | null>(null);

/**
 * DatePicker Context Hook
 *
 * DatePicker 하위 컴포넌트에서 Context 값에 접근하기 위한 훅입니다.
 *
 * @throws {Error} DatePicker 컴포넌트 외부에서 사용 시 에러 발생
 * @returns DatePickerContextValue
 *
 * @example
 * ```tsx
 * function DatePickerItem() {
 *   const { selectedDate, onDateSelect } = useDatePickerContext();
 *   // ...
 * }
 * ```
 */
export function useDatePickerContext() {
  const context = React.useContext(DatePickerContext);
  if (!context) {
    throw new Error(
      "DatePicker 컴포넌트는 DatePicker 컴포넌트 내부에서 사용되어야 합니다"
    );
  }
  return context;
}

/**
 * DatePicker Provider Props
 */
export interface DatePickerProviderProps {
  children: React.ReactNode;

  // 선택 모드
  type?: "single" | "range";

  // Single 모드 (제어/비제어)
  value?: Date | null;
  defaultValue?: Date | null;
  onValueChange?: (value: Date | null) => void;

  // Range 모드 (제어/비제어)
  rangeValue?: DateRange | null;
  defaultRangeValue?: DateRange | null;
  onRangeValueChange?: (value: DateRange | null) => void;

  // 시간 선택
  timePicker?: boolean;

  // 제약 조건
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[] | ((date: Date) => boolean);

  // 로케일
  locale?: Locale;

  // 출력 포맷
  formatType?: "date" | "iso" | "custom";
  customFormat?: string;

  // 인디케이터
  indicator?: (date: Date) => React.ReactNode;
}

/**
 * DatePicker Context Provider
 *
 * 날짜 선택 상태를 관리하고 하위 컴포넌트에 제공합니다.
 * 제어 컴포넌트와 비제어 컴포넌트 모두 지원합니다.
 */
export function DatePickerProvider({
  children,
  type = "single",
  value: controlledValue,
  defaultValue,
  onValueChange: onValueChangeProp,
  rangeValue: controlledRangeValue,
  defaultRangeValue,
  onRangeValueChange: onRangeValueChangeProp,
  timePicker = false,
  minDate,
  maxDate,
  disabledDates,
  locale = ko,
  formatType = "date",
  customFormat,
  indicator,
}: DatePickerProviderProps) {
  // ============================================================================
  // State: Single Mode
  // ============================================================================

  const [uncontrolledDate, setUncontrolledDate] = React.useState<Date | null>(
    defaultValue ?? null
  );

  const isControlledSingle = controlledValue !== undefined;
  const selectedDate = isControlledSingle ? controlledValue : uncontrolledDate;

  // ============================================================================
  // State: Range Mode
  // ============================================================================

  const [uncontrolledRange, setUncontrolledRange] = React.useState<DateRange | null>(
    defaultRangeValue ?? null
  );

  const isControlledRange = controlledRangeValue !== undefined;
  const selectedRange = isControlledRange
    ? controlledRangeValue
    : uncontrolledRange;

  // ============================================================================
  // State: Hover (Range Mode Preview)
  // ============================================================================

  const [hoveredDate, setHoveredDate] = React.useState<Date | null>(null);

  // ============================================================================
  // Ref: Track range selection phase (for controlled components)
  // ============================================================================

  const rangeSelectionPhaseRef = React.useRef<"idle" | "awaiting-end">("idle");

  // ============================================================================
  // State: Display Month (Calendar Navigation)
  // ============================================================================

  const [displayMonth, setDisplayMonth] = React.useState<Date>(() => {
    if (type === "single" && selectedDate) return selectedDate;
    if (type === "range" && selectedRange?.start) return selectedRange.start;
    return new Date();
  });

  // ============================================================================
  // State: Time Picker
  // ============================================================================

  const [selectedTime, setSelectedTime] = React.useState<TimeValue | null>(null);

  // ============================================================================
  // State: UI (Popover Open/Close)
  // ============================================================================

  const [isOpen, setIsOpen] = React.useState(false);

  // ============================================================================
  // State: Keyboard Navigation
  // ============================================================================

  const [focusedDate, setFocusedDate] = React.useState<Date | null>(null);

  // ============================================================================
  // Callback: Date Select (Single Mode)
  // ============================================================================

  const handleDateSelect = React.useCallback(
    (date: Date | null) => {
      if (type === "single") {
        if (!isControlledSingle) {
          setUncontrolledDate(date);
        }
        if (date) {
          // Apply format conversion before calling callback
          const formattedValue = formatDateOutput(date, formatType, customFormat);
          onValueChangeProp?.(formattedValue as any);
        }
      }
    },
    [type, isControlledSingle, onValueChangeProp, formatType, customFormat]
  );

  // ============================================================================
  // Callback: Range Select (Range Mode)
  // ============================================================================

  const handleRangeSelect = React.useCallback(
    (range: DateRange) => {
      console.log("[DatePickerContext] handleRangeSelect called with:", range);
      console.log("[DatePickerContext] type:", type, "isControlledRange:", isControlledRange);

      if (type === "range") {
        // Update ref to track selection phase
        if (isSameDay(range.start, range.end)) {
          console.log("[DatePickerContext] Setting phase to 'awaiting-end'");
          rangeSelectionPhaseRef.current = "awaiting-end";
        } else {
          console.log("[DatePickerContext] Setting phase to 'idle' (range complete)");
          rangeSelectionPhaseRef.current = "idle";
        }

        if (!isControlledRange) {
          console.log("[DatePickerContext] Updating uncontrolled range state");
          setUncontrolledRange(range);
        }
        console.log("[DatePickerContext] Calling onRangeValueChangeProp");

        // Apply format conversion before calling callback
        const formattedRange = {
          start: formatDateOutput(range.start, formatType, customFormat),
          end: formatDateOutput(range.end, formatType, customFormat),
        };
        onRangeValueChangeProp?.(formattedRange as any);
      }
    },
    [type, isControlledRange, onRangeValueChangeProp, formatType, customFormat]
  );

  // ============================================================================
  // Callback: Time Change
  // ============================================================================

  const handleTimeChange = React.useCallback((time: TimeValue) => {
    setSelectedTime(time);
  }, []);

  // ============================================================================
  // Callback: Month Change
  // ============================================================================

  const handleMonthChange = React.useCallback((month: Date) => {
    setDisplayMonth(month);
  }, []);

  // ============================================================================
  // Callback: Hover Date Change
  // ============================================================================

  const handleHoverDateChange = React.useCallback((date: Date | null) => {
    setHoveredDate(date);
  }, []);

  // ============================================================================
  // Context Value
  // ============================================================================

  const contextValue = React.useMemo<DatePickerContextValue>(
    () => ({
      // Selection mode
      type,

      // Date state
      selectedDate,
      selectedRange,
      hoveredDate,
      displayMonth,

      // Time state
      hasTimePicker: timePicker,
      selectedTime,

      // Constraints
      minDate,
      maxDate,
      disabledDates,
      locale,

      // Callbacks
      onDateSelect: handleDateSelect,
      onRangeSelect: handleRangeSelect,
      onTimeChange: handleTimeChange,
      onMonthChange: handleMonthChange,
      onHoverDateChange: handleHoverDateChange,

      // UI state
      isOpen,
      setIsOpen,
      focusedDate,
      setFocusedDate,

      // Range selection phase
      rangeSelectionPhaseRef,

      // Output format
      formatType,
      customFormat,

      // Indicator
      indicator,
    }),
    [
      type,
      selectedDate,
      selectedRange,
      hoveredDate,
      displayMonth,
      timePicker,
      selectedTime,
      minDate,
      maxDate,
      disabledDates,
      locale,
      handleDateSelect,
      handleRangeSelect,
      handleTimeChange,
      handleMonthChange,
      handleHoverDateChange,
      isOpen,
      focusedDate,
      formatType,
      customFormat,
      onValueChangeProp,
      indicator,
    ]
  );

  return (
    <DatePickerContext.Provider value={contextValue}>
      {children}
    </DatePickerContext.Provider>
  );
}
