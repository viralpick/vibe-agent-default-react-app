"use client";

import type {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  Row,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import React from "react";
import {
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { cn } from "@/lib/commerce-sdk";

import { DataTableProvider } from "./data-table-context";
import { useStickyColumns } from "./data-table-sticky";
import { textFilterFn } from "./types";
import type { DataTableSize } from "./types";

type DataTableRootProps<TData, TValue> = {
  data: TData[];
  columns: ColumnDef<TData, TValue>[];
  size?: DataTableSize;
  pageSize?: number;
  pageIndex?: number;
  totalCount?: number;
  totalPageCount?: number;
  manualPagination?: boolean;
  onPageChange?: (pageIndex: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  searchKeys?: (keyof TData)[];
  initialSorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  enableRowSelection?: boolean;
  onRowClick?: (row: TData) => void;
  isRowInteractive?: (row: Row<TData>) => boolean;
  onSearch?: (searchTerm: string) => void;
  children: React.ReactNode;
  className?: string;
  queryId?: string;
  queryContent?: string;
};

function DataTableRoot<TData, TValue>({
  data,
  columns,
  size = "default",
  pageSize = 10,
  pageIndex: pageIndexProp,
  totalCount,
  totalPageCount,
  manualPagination,
  onPageChange,
  onPageSizeChange,
  searchKeys = [],
  initialSorting = [],
  onSortingChange: onSortingChangeProp,
  enableRowSelection = false,
  onRowClick,
  isRowInteractive,
  onSearch,
  children,
  className,
  queryId,
  queryContent,
}: DataTableRootProps<TData, TValue>): React.JSX.Element {
  const [rowSelection, setRowSelection] = React.useState({});
  const [internalPagination, setInternalPagination] =
    React.useState<PaginationState>({
      pageIndex: 0,
      pageSize,
    });
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);

  const pagination = manualPagination
    ? { pageIndex: pageIndexProp ?? 0, pageSize }
    : internalPagination;

  const table = useReactTable({
    data,
    columns,
    state: {
      pagination,
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    initialState: { pagination: { pageSize } },
    manualPagination,
    autoResetPageIndex: false,
    pageCount: manualPagination
      ? totalPageCount ??
        (totalCount ? Math.ceil(totalCount / pageSize) : undefined)
      : undefined,
    onPaginationChange: manualPagination
      ? (updater) => {
          const next =
            typeof updater === "function" ? updater(pagination) : updater;
          onPageChange?.(next.pageIndex);
        }
      : (updater) => {
          const next =
            typeof updater === "function"
              ? updater(internalPagination)
              : updater;
          setInternalPagination(next);
        },
    enableRowSelection,
    enableSortingRemoval: true,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    onRowSelectionChange: setRowSelection,
    manualSorting: onSortingChangeProp ? true : false,
    onSortingChange: onSortingChangeProp
      ? (updater) => {
          const next =
            typeof updater === "function" ? updater(sorting) : updater;
          setSorting(next);
          onSortingChangeProp(next);
        }
      : setSorting,
    onColumnFiltersChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(columnFilters) : updater;
      setColumnFilters(next);
    },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    filterFns: { textFilter: textFilterFn },
    globalFilterFn: (row, _columnId, filterValue) => {
      return (
        searchKeys?.some((key) => {
          const cellValue = row.getValue(key as string);
          return String(cellValue)
            .toLowerCase()
            .includes(String(filterValue).toLowerCase());
        }) ?? false
      );
    },
  });

  // Reset page index when filters change
  React.useEffect(() => {
    if (manualPagination) return;
    setInternalPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [columnFilters, table.getState().globalFilter]);

  const stickyPositionMap = useStickyColumns(table);

  const handlePageSizeChange =
    manualPagination && onPageSizeChange
      ? onPageSizeChange
      : (value: number) => table.setPageSize(value);

  return (
    <DataTableProvider
      value={{
        table: table as never,
        size,
        searchKeys: searchKeys as never,
        onSearch,
        onRowClick: onRowClick as never,
        isRowInteractive: isRowInteractive as never,
        handlePageSizeChange,
        stickyPositionMap,
        queryId,
        queryContent,
      }}
    >
      <div className={cn("flex flex-col gap-1", className)}>{children}</div>
    </DataTableProvider>
  );
}

DataTableRoot.displayName = "DataTable";

export { DataTableRoot };
export type { DataTableRootProps };
