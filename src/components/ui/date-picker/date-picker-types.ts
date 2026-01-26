import type { Locale } from "date-fns";

/**
 * 날짜 범위 타입
 *
 * @property {Date} start - 시작 날짜
 * @property {Date} end - 종료 날짜
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * 시간 값 타입
 *
 * @property {number} hours - 시간 (0-23)
 * @property {number} minutes - 분 (0-59)
 */
export interface TimeValue {
  hours: number;
  minutes: number;
}

/**
 * 범위 프리셋 타입
 *
 * @property {string} label - 영문 레이블
 * @property {string} labelKo - 한글 레이블
 * @property {function} getValue - 범위 값을 반환하는 함수
 */
export interface PresetRange {
  label: string;
  labelKo: string;
  getValue: () => DateRange;
}

/**
 * 월 옵션 타입 (드롭다운용)
 *
 * @property {number} value - 월 인덱스 (0-11)
 * @property {string} label - 표시 레이블
 */
export interface MonthOption {
  value: number;
  label: string;
}

/**
 * 연도 옵션 타입 (드롭다운용)
 *
 * @property {number} value - 연도
 * @property {string} label - 표시 레이블
 */
export interface YearOption {
  value: number;
  label: string;
}

/**
 * 연도/월 조합 옵션 타입 (드롭다운용)
 *
 * @property {string} value - "YYYY-MM" 형식의 문자열
 * @property {string} label - 표시 레이블
 */
export interface MonthYearOption {
  value: string;
  label: string;
}

/**
 * DatePicker Context 값 타입
 *
 * Context를 통해 모든 하위 컴포넌트에서 접근 가능한 상태와 콜백
 */
export interface DatePickerContextValue {
  // 선택 모드
  type: "single" | "range";

  // 날짜 상태
  selectedDate: Date | null; // single 모드
  selectedRange: DateRange | null; // range 모드
  hoveredDate: Date | null; // range 미리보기
  displayMonth: Date; // 현재 표시 중인 월

  // 시간 상태
  hasTimePicker: boolean;
  selectedTime: TimeValue | null;

  // 제약 조건
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[] | ((date: Date) => boolean);
  locale: Locale;

  // 콜백
  onDateSelect: (date: Date | null) => void;
  onRangeSelect: (range: DateRange) => void;
  onTimeChange: (time: TimeValue) => void;
  onMonthChange: (month: Date) => void;
  onHoverDateChange: (date: Date | null) => void;

  // UI 상태
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  focusedDate: Date | null; // 키보드 네비게이션용
  setFocusedDate: (date: Date | null) => void;

  // 범위 선택 상태 (controlled component용)
  rangeSelectionPhaseRef: React.RefObject<"idle" | "awaiting-end">;

  // 출력 포맷
  formatType: "date" | "iso" | "custom";
  customFormat?: string;

  // 인디케이터 (날짜별 커스텀 렌더링)
  indicator?: (date: Date) => React.ReactNode;
}

/**
 * 날짜 아이템의 상태를 결정하는 플래그들
 */
export interface DateItemState {
  isSelected: boolean;
  isToday: boolean;
  isDisabled: boolean;
  isOutsideMonth: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  isInRange: boolean;
  isHovered: boolean;
}
