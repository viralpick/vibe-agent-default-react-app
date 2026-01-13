"use client";

import type { Table } from "@tanstack/react-table";
import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SingleSelect } from "@/components/ui/single-select";

type DataTablePaginationProps<TData> = {
  table: Table<TData>;
  onPageSizeChange: (pageSize: number) => void;
  showPageSize?: boolean;
  pageSizeOptions?: number[];
};

function DataTablePagination<TData>({
  table,
  onPageSizeChange,
  showPageSize = true,
  pageSizeOptions = [10, 20, 50, 100],
}: DataTablePaginationProps<TData>): React.JSX.Element | null {
  "use no memo";

  if (table.getPageCount() <= 1) {
    return null;
  }

  return (
    <div className="flex gap-6">
      {showPageSize && (
        <div className="flex items-center gap-2">
          <span className="text-sm">페이지 당 데이터 수</span>
          <SingleSelect
            className="min-w-20"
            value={String(table.getState().pagination.pageSize)}
            showSearch={false}
            options={pageSizeOptions.map((option) => ({
              label: String(option),
              value: String(option),
            }))}
            onChange={(value) => onPageSizeChange(Number(value))}
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        {table.options.enableRowSelection && (
          <div className="flex-1 text-sm text-muted-foreground">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
        )}

        <div className="ml-auto flex items-center gap-6 lg:gap-8">
          <div className="flex min-w-[140px] items-center justify-center text-sm">
            {table.getState().pagination.pageIndex + 1}페이지 (총{" "}
            {table.getPageCount()}페이지)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              className="hidden lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">첫 페이지로 이동</span>
              <ChevronsLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">이전 페이지로 이동</span>
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">다음 페이지로 이동</span>
              <ChevronRight />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className="hidden lg:flex"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">마지막 페이지로 이동</span>
              <ChevronsRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { DataTablePagination };
