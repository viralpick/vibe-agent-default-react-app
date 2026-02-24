"use client";

import type { Table } from "@tanstack/react-table";
import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Button, Select } from "@viralpick/synapse";
import { useTranslation } from "@/hooks/useTranslation";

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
  const t = useTranslation();

  if (table.getPageCount() <= 1) {
    return null;
  }

  return (
    <div className="flex gap-1.5">
      {showPageSize && (
        <div className="flex items-center gap-2">
          <span className="text-sm">{t.dataTable.rowsPerPage}</span>
          <Select
            className="min-w-8"
            value={String(table.getState().pagination.pageSize)}
            options={pageSizeOptions.map((option) => ({
              label: String(option),
              value: String(option),
            }))}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        {table.options.enableRowSelection && (
          <div className="flex-1 text-caption-1 text-text-secondary">
            {t.dataTable.rowsSelected(
              table.getFilteredSelectedRowModel().rows.length,
              table.getFilteredRowModel().rows.length
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5 lg:gap-2">
          <div className="flex min-w-[140px] items-center justify-center text-caption-1 text-text-secondary">
            {t.dataTable.pageOf(
              table.getState().pagination.pageIndex + 1,
              table.getPageCount()
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              buttonStyle="ghost"
              buttonType="icon"
              size="sm"
              className="hidden lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">{t.dataTable.goToFirstPage}</span>
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              buttonStyle="ghost"
              buttonType="icon"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">{t.dataTable.goToPreviousPage}</span>
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              buttonStyle="ghost"
              buttonType="icon"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">{t.dataTable.goToNextPage}</span>
              <ChevronRight className="size-4" />
            </Button>
            <Button
              buttonStyle="ghost"
              buttonType="icon"
              size="sm"
              className="hidden lg:flex"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">{t.dataTable.goToLastPage}</span>
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { DataTablePagination };
