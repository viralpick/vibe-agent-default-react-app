import type { Translations } from "./types";

export const ko: Translations = {
  datePeriod: {
    today: "오늘",
    last7Days: "최근 7일",
    last30Days: "최근 30일",
    last90Days: "최근 90일",
    placeholder: "기간 선택",
    quickSelect: "빠른 선택",
    monthlySelect: "월별 선택",
    customSelect: "직접 선택",
    selectDateRange: "날짜 범위 선택...",
    dateRangeTitle: "날짜 범위 선택",
    cancel: "취소",
    apply: "적용",
    monthFormat: (year: number, month: number) => `${year}년 ${month}월`,
  },
  table: {
    link: "링크",
  },
  statusCard: {
    ratingSuffix: "점",
  },
  dataTable: {
    noResults: "결과가 없습니다.",
    rowsPerPage: "페이지 당 데이터 수",
    rowsSelected: (selected: number, total: number) => `${selected}개 중 ${total}개 선택됨`,
    pageOf: (page: number, totalPages: number) => `${page}페이지 (총 ${totalPages}페이지)`,
    goToFirstPage: "첫 페이지로 이동",
    goToPreviousPage: "이전 페이지로 이동",
    goToNextPage: "다음 페이지로 이동",
    goToLastPage: "마지막 페이지로 이동",
    showColumns: "컬럼 표시",
    addFilter: "추가",
    resetFilters: "필터 초기화",
    results: (count: number) => `${count}개 결과`,
    where: "조건",
    enterValue: "값 입력",
    sortAsc: "오름차순",
    sortDesc: "내림차순",
    hide: "숨기기",
  },
  column: {
    checkStatusSkipTooltip: "개인정보 처리 검사는 현재 네이버 플랫폼만 지원합니다.",
  },
};
