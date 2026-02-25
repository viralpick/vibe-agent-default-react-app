export interface Translations {
  datePeriod: {
    today: string;
    last7Days: string;
    last30Days: string;
    last90Days: string;
    placeholder: string;
    quickSelect: string;
    monthlySelect: string;
    customSelect: string;
    selectDateRange: string;
    dateRangeTitle: string;
    cancel: string;
    apply: string;
    monthFormat: (year: number, month: number) => string;
  };
  table: {
    link: string;
  };
  statusCard: {
    ratingSuffix: string;
  };
  dataTable: {
    noResults: string;
    rowsPerPage: string;
    rowsSelected: (selected: number, total: number) => string;
    pageOf: (page: number, totalPages: number) => string;
    goToFirstPage: string;
    goToPreviousPage: string;
    goToNextPage: string;
    goToLastPage: string;
    showColumns: string;
    addFilter: string;
    resetFilters: string;
    results: (count: number) => string;
    where: string;
    enterValue: string;
    sortAsc: string;
    sortDesc: string;
    hide: string;
  };
  column: {
    checkStatusSkipTooltip: string;
  };
}
