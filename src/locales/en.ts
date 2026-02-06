import type { Translations } from "./types";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export const en: Translations = {
  datePeriod: {
    today: "Today",
    last7Days: "Last 7 days",
    last30Days: "Last 30 days",
    last90Days: "Last 90 days",
    placeholder: "Select period",
    quickSelect: "Quick select",
    monthlySelect: "Monthly",
    customSelect: "Custom",
    selectDateRange: "Select date range...",
    dateRangeTitle: "Select date range",
    cancel: "Cancel",
    apply: "Apply",
    monthFormat: (year: number, month: number) => `${MONTH_NAMES[month - 1]} ${year}`,
  },
  table: {
    link: "Link",
  },
  statusCard: {
    ratingSuffix: "pts",
  },
  dataTable: {
    noResults: "No results.",
    rowsPerPage: "Rows per page",
    rowsSelected: (selected: number, total: number) => `${selected} of ${total} row(s) selected`,
    pageOf: (page: number, totalPages: number) => `Page ${page} of ${totalPages}`,
    goToFirstPage: "Go to first page",
    goToPreviousPage: "Go to previous page",
    goToNextPage: "Go to next page",
    goToLastPage: "Go to last page",
    showColumns: "Show columns",
    addFilter: "Add",
    resetFilters: "Reset filters",
    results: (count: number) => `${count} results`,
    where: "Where",
    enterValue: "Enter value",
    sortAsc: "Asc",
    sortDesc: "Desc",
    hide: "Hide",
  },
};
