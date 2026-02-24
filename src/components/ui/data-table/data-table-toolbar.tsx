"use client";
"use no memo";

import type { Table } from "@tanstack/react-table";
import { Download, Search, X } from "lucide-react";
import React from "react";

import { cn } from "@/lib/commerce-sdk";

import { Button, Input, MultiSelect } from "@viralpick/synapse";
import { useTranslation } from "@/hooks/useTranslation";

type DataTableToolbarProps<TData> = {
  table: Table<TData>;
  full?: boolean;
  placeholder?: string;
  showSearch?: boolean;
  showOptions?: boolean;
  customToolbar?: React.JSX.Element;
  onDownload?: () => void;
  downloadButtonText?: string;
  downloadDisabled?: boolean;
  onSearch?: (searchTerm: string) => void;
  controlsOnLeft?: boolean;
  customControlsOnLeft?: boolean;
  customLeftContainer?: React.JSX.Element;
  customRightContainer?: React.JSX.Element;
  classNames?: {
    search?: string;
  };
};

function DataTableToolbar<TData>({
  table,
  full = false,
  placeholder = 'Search...',
  classNames,
  showSearch = true,
  showOptions = false,
  customToolbar,
  onDownload,
  downloadButtonText,
  downloadDisabled,
  onSearch,
  controlsOnLeft = true,
  customControlsOnLeft = true,
  customLeftContainer,
  customRightContainer,
}: DataTableToolbarProps<TData>): React.JSX.Element {
  const globalFilter = table.getState().globalFilter ?? "";
  const isFiltered = table.getState().columnFilters.length > 0;

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    table.setGlobalFilter(value);
    onSearch?.(value);
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-0.5",
        !full ? "ml-auto" : "w-full"
      )}
    >
      <div className={cn("flex items-start gap-0.5", full && "flex-1")}>
        {/* custom toolbar 좌측 노출 */}
        {!customControlsOnLeft && customToolbar}
        {showSearch && (
          <div className="flex items-center gap-0.5">
            <Input
              size='sm'
              leadIcon={<Search className="size-4" />}
              placeholder={placeholder}
              value={globalFilter}
              onChange={handleSearch}
              className={classNames?.search}
            />
            {isFiltered && (
              <Button
                buttonStyle="secondary"
                buttonType="icon"
                size="sm"
                onClick={() => table.resetColumnFilters()}
              >
                <X />
              </Button>
            )}
          </div>
        )}
        {controlsOnLeft && (
          <div className="flex items-center gap-0.5">
            {showOptions && <DataTableViewOptions table={table} />}
            {onDownload && (
              <Button
                buttonStyle="secondary"
                onClick={onDownload}
                className={cn("h-8", !downloadButtonText && "px-0.5!")}
                disabled={downloadDisabled}
              >
                <Download /> {downloadButtonText}
              </Button>
            )}
            {customLeftContainer}
          </div>
        )}
      </div>

      <div className="flex items-center gap-0.5">
        {!controlsOnLeft && showOptions && (
          <DataTableViewOptions table={table} />
        )}
        {!controlsOnLeft && onDownload && (
          <Button
            buttonStyle="secondary"
            onClick={onDownload}
            className={cn("h-8", !downloadButtonText && "px-0.5!")}
          >
            <Download /> {downloadButtonText}
          </Button>
        )}
        {/* custom toolbar 우측 노출 */}
        {customControlsOnLeft && customToolbar}
        {customRightContainer}
      </div>
    </div>
  );
}

type DataTableViewOptionsProps<TData> = {
  table: Table<TData>;
};

export function DataTableViewOptions<TData>({
  table,
}: DataTableViewOptionsProps<TData>): React.JSX.Element {
  const t = useTranslation();
  const columns = table
    .getAllColumns()
    .filter(
      (column) => typeof column.accessorFn !== "undefined" && column.getCanHide()
    );

  const options = columns.map((column) => ({
    value: column.id,
    label: (column.columnDef.meta?.title as string) ?? column.id,
  }));

  const values = columns
    .filter((column) => column.getIsVisible())
    .map((column) => column.id);

  const handleValuesChange = (newValues: string[]) => {
    columns.forEach((column) => {
      column.toggleVisibility(newValues.includes(column.id));
    });
  };

  return (
    <MultiSelect
      size="sm"
      placeholder={t.dataTable.showColumns}
      options={options}
      values={values}
      onValuesChange={handleValuesChange}
      className="ml-auto hidden lg:flex w-[180px]"
    />
  );
}

export { DataTableToolbar };
