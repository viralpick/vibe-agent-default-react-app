import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isAfter,
  isBefore,
  isWithinInterval,
  subDays,
  format,
  parse,
  isValid,
  setHours,
  setMinutes,
  startOfYear,
  endOfYear,
  type Locale,
} from "date-fns";
import { ko } from "date-fns/locale";
import type { DateRange, TimeValue, PresetRange, MonthOption, YearOption, MonthYearOption } from "./date-picker-types";

/**
 * 주어진 월의 달력 그리드를 생성합니다
 *
 * 주의 시작을 기준으로 5주 또는 6주(35일 또는 42일)의 날짜 배열을 반환합니다.
 * 이전/다음 월의 날짜도 포함되어 완전한 주간 그리드를 형성합니다.
 *
 * @param month - 표시할 월의 기준 날짜
 * @param locale - date-fns 로케일 (기본값: ko)
 * @returns 달력 그리드를 구성하는 날짜 배열 (35 또는 42개)
 *
 * @example
 * ```ts
 * const days = generateCalendarDays(new Date(2024, 0, 1), ko);
 * // Returns: 2023-12-31부터 2024-02-03까지의 날짜들
 * ```
 */
export function generateCalendarDays(month: Date, locale: Locale = ko): Date[] {
  const start = startOfWeek(startOfMonth(month), { locale });
  const end = endOfWeek(endOfMonth(month), { locale });
  return eachDayOfInterval({ start, end });
}

/**
 * 날짜가 제약 조건에 의해 비활성화되어야 하는지 확인합니다
 *
 * @param date - 확인할 날짜
 * @param minDate - 최소 허용 날짜 (선택)
 * @param maxDate - 최대 허용 날짜 (선택)
 * @param disabledDates - 비활성화할 날짜 배열 또는 조건 함수 (선택)
 * @returns 날짜가 비활성화되어야 하면 true
 *
 * @example
 * ```ts
 * // 최소/최대 날짜 체크
 * isDateDisabled(new Date(2024, 0, 1), new Date(2024, 0, 10), new Date(2024, 11, 31));
 *
 * // 특정 날짜 배열
 * isDateDisabled(date, undefined, undefined, [new Date(2024, 0, 15)]);
 *
 * // 조건 함수 (주말 비활성화)
 * isDateDisabled(date, undefined, undefined, (d) => d.getDay() === 0 || d.getDay() === 6);
 * ```
 */
export function isDateDisabled(
  date: Date,
  minDate?: Date,
  maxDate?: Date,
  disabledDates?: Date[] | ((date: Date) => boolean)
): boolean {
  if (minDate && isBefore(date, minDate)) return true;
  if (maxDate && isAfter(date, maxDate)) return true;

  if (Array.isArray(disabledDates)) {
    return disabledDates.some((d) => isSameDay(d, date));
  }
  if (typeof disabledDates === "function") {
    return disabledDates(date);
  }

  return false;
}

/**
 * 날짜가 지정된 범위 내에 있는지 확인합니다
 *
 * @param date - 확인할 날짜
 * @param range - 날짜 범위 (start, end)
 * @returns 날짜가 범위 내에 있으면 true
 */
export function isDateInRange(date: Date, range: DateRange | null): boolean {
  if (!range?.start || !range?.end) return false;
  return isWithinInterval(date, { start: range.start, end: range.end });
}

/**
 * 날짜가 현재 표시 중인 월에 속하는지 확인합니다
 *
 * @param date - 확인할 날짜
 * @param displayMonth - 현재 표시 중인 월
 * @returns 같은 월이면 true
 */
export function isDateInDisplayMonth(date: Date, displayMonth: Date): boolean {
  return isSameMonth(date, displayMonth);
}

/**
 * 날짜를 지정된 출력 형식으로 변환합니다
 *
 * @param date - 변환할 날짜
 * @param formatType - 출력 형식 타입 ('date' | 'iso' | 'custom')
 * @param customFormat - custom 타입일 때 사용할 date-fns 형식 문자열
 * @returns 변환된 날짜 (Date 객체 또는 문자열)
 *
 * @example
 * ```ts
 * formatDateOutput(new Date(), 'date');  // Date 객체
 * formatDateOutput(new Date(), 'iso');   // "2024-01-15T09:30:00.000Z"
 * formatDateOutput(new Date(), 'custom', 'yyyy년 M월 d일');  // "2024년 1월 15일"
 * ```
 */
export function formatDateOutput(
  date: Date,
  formatType: "date" | "iso" | "custom",
  customFormat?: string
): Date | string {
  if (formatType === "date") return date;
  if (formatType === "iso") return date.toISOString();
  if (formatType === "custom" && customFormat) {
    return format(date, customFormat, { locale: ko });
  }
  return date;
}

/**
 * 사용자 입력 문자열을 날짜 객체로 파싱합니다
 *
 * @param input - 파싱할 문자열 (예: "2024-01-15")
 * @param formatPattern - 입력 형식 패턴 (기본값: "yyyy-MM-dd")
 * @param locale - date-fns 로케일 (기본값: ko)
 * @returns 유효한 날짜면 Date 객체, 아니면 null
 *
 * @example
 * ```ts
 * parseUserInput("2024-01-15");  // new Date(2024, 0, 15)
 * parseUserInput("2024/01/15", "yyyy/MM/dd");  // new Date(2024, 0, 15)
 * parseUserInput("invalid");  // null
 * ```
 */
export function parseUserInput(
  input: string,
  formatPattern: string = "yyyy-MM-dd",
  locale: Locale = ko
): Date | null {
  const parsed = parse(input, formatPattern, new Date(), { locale });
  return isValid(parsed) ? parsed : null;
}

/**
 * 시간 문자열을 TimeValue 객체로 파싱합니다
 *
 * @param input - 시간 문자열 (예: "14:30", "9:05")
 * @returns 유효한 시간이면 TimeValue 객체, 아니면 null
 *
 * @example
 * ```ts
 * parseTimeInput("14:30");  // { hours: 14, minutes: 30 }
 * parseTimeInput("9:05");   // { hours: 9, minutes: 5 }
 * parseTimeInput("25:00");  // null (invalid)
 * parseTimeInput("12:70");  // null (invalid)
 * ```
 */
export function parseTimeInput(input: string): TimeValue | null {
  const match = input.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return { hours, minutes };
}

/**
 * TimeValue 객체를 HH:mm 형식 문자열로 변환합니다
 *
 * @param time - 시간 값 객체
 * @returns HH:mm 형식의 문자열
 *
 * @example
 * ```ts
 * formatTime({ hours: 9, minutes: 5 });   // "09:05"
 * formatTime({ hours: 14, minutes: 30 }); // "14:30"
 * ```
 */
export function formatTime(time: TimeValue): string {
  return `${String(time.hours).padStart(2, "0")}:${String(time.minutes).padStart(2, "0")}`;
}

/**
 * 날짜와 시간을 결합하여 하나의 Date 객체를 생성합니다
 *
 * @param date - 날짜 부분
 * @param time - 시간 부분
 * @returns 결합된 Date 객체
 *
 * @example
 * ```ts
 * const combined = combineDateAndTime(
 *   new Date(2024, 0, 15),
 *   { hours: 14, minutes: 30 }
 * );
 * // Result: 2024-01-15 14:30:00
 * ```
 */
export function combineDateAndTime(date: Date, time: TimeValue): Date {
  return setMinutes(setHours(date, time.hours), time.minutes);
}

/**
 * 범위 프리셋 목록을 생성합니다
 *
 * @returns 프리셋 범위 배열 (Today, Last 7 Days, This Month, This Year)
 */
export function getPresetRanges(): PresetRange[] {
  const today = new Date();

  return [
    {
      label: "Today",
      labelKo: "오늘",
      getValue: () => ({ start: today, end: today }),
    },
    {
      label: "Last 7 Days",
      labelKo: "최근 7일",
      getValue: () => ({
        start: subDays(today, 6),
        end: today,
      }),
    },
    {
      label: "This Month",
      labelKo: "이번 달",
      getValue: () => ({
        start: startOfMonth(today),
        end: endOfMonth(today),
      }),
    },
    {
      label: "This Year",
      labelKo: "올해",
      getValue: () => ({
        start: startOfYear(today),
        end: endOfYear(today),
      }),
    },
  ];
}

/**
 * 월 선택 드롭다운용 옵션 배열을 생성합니다
 *
 * @param locale - date-fns 로케일 (기본값: ko)
 * @returns 월 옵션 배열 (0-11월)
 *
 * @example
 * ```ts
 * getMonthOptions(ko);
 * // Returns: [
 * //   { value: 0, label: "1월" },
 * //   { value: 1, label: "2월" },
 * //   ...
 * // ]
 * ```
 */
export function getMonthOptions(locale: Locale = ko): MonthOption[] {
  return Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: format(new Date(2024, i, 1), "MMMM", { locale }),
  }));
}

/**
 * 연도 선택 드롭다운용 옵션 배열을 생성합니다
 *
 * 현재 연도를 기준으로 ±10년 범위의 옵션을 생성합니다.
 *
 * @param currentYear - 기준 연도 (기본값: 현재 연도)
 * @returns 연도 옵션 배열
 *
 * @example
 * ```ts
 * getYearOptions(2024);
 * // Returns: [
 * //   { value: 2014, label: "2014" },
 * //   { value: 2015, label: "2015" },
 * //   ...
 * //   { value: 2034, label: "2034" }
 * // ]
 * ```
 */
export function getYearOptions(
  currentYear: number = new Date().getFullYear()
): YearOption[] {
  const startYear = currentYear - 10;
  const endYear = currentYear + 10;

  return Array.from({ length: endYear - startYear + 1 }, (_, i) => ({
    value: startYear + i,
    label: String(startYear + i),
  }));
}

/**
 * 연도와 월이 결합된 옵션 배열을 생성합니다
 *
 * 현재 연도를 기준으로 ±10년 범위의 모든 월 옵션을 생성합니다.
 *
 * @param currentYear - 기준 연도
 * @param locale - date-fns 로케일
 * @returns 연도/월 조합 옵션 배열
 */
export function getMonthYearOptions(
  currentYear: number = new Date().getFullYear(),
  locale: Locale = ko
): MonthYearOption[] {
  const startYear = currentYear - 10;
  const endYear = currentYear + 10;
  const options: MonthYearOption[] = [];

  for (let year = startYear; year <= endYear; year++) {
    for (let month = 0; month < 12; month++) {
      const date = new Date(year, month, 1);
      options.push({
        value: `${year}-${month}`,
        label: format(date, "yyyy년 M월", { locale }),
      });
    }
  }

  return options;
}

/**
 * 날짜를 표시용 문자열로 포맷합니다
 *
 * @param date - 포맷할 날짜
 * @param formatPattern - date-fns 형식 문자열 (기본값: "yyyy-MM-dd")
 * @param locale - date-fns 로케일 (기본값: ko)
 * @returns 포맷된 문자열
 *
 * @example
 * ```ts
 * formatDateForDisplay(new Date(2024, 0, 15));  // "2024-01-15"
 * formatDateForDisplay(new Date(2024, 0, 15), "yyyy년 M월 d일");  // "2024년 1월 15일"
 * ```
 */
export function formatDateForDisplay(
  date: Date,
  formatPattern: string = "yyyy-MM-dd",
  locale: Locale = ko
): string {
  return format(date, formatPattern, { locale });
}

/**
 * 날짜 범위를 표시용 문자열로 포맷합니다
 *
 * @param range - 날짜 범위
 * @param formatPattern - date-fns 형식 문자열 (기본값: "yyyy-MM-dd")
 * @param separator - 구분자 (기본값: " - ")
 * @param locale - date-fns 로케일 (기본값: ko)
 * @returns 포맷된 문자열
 *
 * @example
 * ```ts
 * formatRangeForDisplay({ start: new Date(2024, 0, 1), end: new Date(2024, 0, 31) });
 * // "2024-01-01 - 2024-01-31"
 * ```
 */
export function formatRangeForDisplay(
  range: DateRange,
  formatPattern: string = "yyyy-MM-dd",
  separator: string = " - ",
  locale: Locale = ko
): string {
  const startStr = format(range.start, formatPattern, { locale });
  const endStr = format(range.end, formatPattern, { locale });
  return `${startStr}${separator}${endStr}`;
}
