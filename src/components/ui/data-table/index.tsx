"use client";

/**
 * @fileoverview Advanced DataTable component built on TanStack Table.
 * Provides sorting, filtering, pagination, search, and column visibility features.
 *
 * @module ui/data-table
 */

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
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { cn } from "@/lib/commerce-sdk";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { DataTableFilter } from "@/components/ui/data-table/data-table-filter";
import { DataTableToolbar } from "@/components/ui/data-table/data-table-toolbar";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";

/**
 * Props for DataTable component
 */
type DataTableProps<TData, TValue> = {
  title?: React.ReactNode;
  overline?: string;
  loading?: boolean;
  size?: "default" | "sm" | "xs";
  data: TData[];
  columns: ColumnDef<TData, TValue>[];
  pageSize?: number;
  pageIndex?: number;
  totalCount?: number;
  totalPageCount?: number;
  manualPagination?: boolean;
  onPageChange?: (pageIndex: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  showPageSize?: boolean;
  showSearch?: boolean;
  showOptions?: boolean;
  showFilter?: boolean;
  pageSizeOptions?: number[];
  searchKeys?: (keyof TData)[];
  searchPlaceholder?: string;
  initialSorting?: SortingState;
  getRowClassName?: (row: Row<TData>) => string;
  customToolbar?: React.JSX.Element;
  onDownload?: () => void;
  downloadButtonText?: string;
  downloadDisabled?: boolean;
  onRowClick?: (row: TData) => void;
  customEmptyRow?: React.JSX.Element;
  onSearch?: (searchTerm: string) => void;
  toolbarControlsAlign?: "left" | "right";
  customToolbarControlsAlign?: "left" | "right";
  isRowInteractive?: (row: Row<TData>) => boolean;
  onSortingChange?: (sorting: SortingState) => void;
  tableClassName?: string;
  headerClassName?: string;
  enableRowSelection?: boolean;
  customLeftContainer?: React.JSX.Element;
  customRightContainer?: React.JSX.Element;
  classNames?: {
    search?: string;
  };
  /** Unique identifier for edit mode (optional) */
  editableId?: string;
  /** File path for edit mode (optional, default: "src/App.tsx") */
  editableFilePath?: string;
  /** Line number in source file for edit mode (optional) */
  editableLineNumber?: string;
};

/**
 * @component DataTable
 * @description A feature-rich data table built on TanStack Table (React Table v8).
 * Supports sorting, filtering, pagination, search, column visibility, sticky columns,
 * row selection, and custom cell rendering.
 *
 * @dataStructure
 * - data: TData[] - Array of row data objects (required)
 * - columns: ColumnDef<TData, TValue>[] - TanStack Table column definitions (required)
 *   - accessorKey: string - Data field key
 *   - header: string | Component - Header content
 *   - cell: Component - Cell renderer
 *   - size/minSize/maxSize: number - Column widths
 *   - meta: { sticky, cellClassName, headerClassName } - Extended options
 * - title?: string | JSX.Element - Table title
 * - loading?: boolean - Shows loading overlay
 * - size?: "default" | "sm" | "xs" - Row density
 * - pageSize?: number - Rows per page (default: 10)
 * - searchKeys?: (keyof TData)[] - Fields to search
 * - showSearch?: boolean - Enable search input
 * - showPageSize?: boolean - Enable page size selector
 * - showOptions?: boolean - Enable column visibility toggle
 * - showFilter?: boolean - Enable advanced filters
 * - manualPagination?: boolean - Server-side pagination mode
 * - onPageChange?: (pageIndex) => void - Page change callback
 * - onRowClick?: (row) => void - Row click handler
 *
 * @designTokens
 * - Uses rounded-md for table container
 * - Uses bg-white for table background
 * - Uses text-xl font-bold for title
 * - Size variants affect padding and font size
 *
 * @useCase
 * - Data management interfaces
 * - Admin panels with CRUD operations
 * - Report tables with sorting/filtering
 * - Any tabular data with advanced interactions
 *
 * @example
 * ```tsx
 * const columns: ColumnDef<User>[] = [
 *   { accessorKey: "name", header: "Name" },
 *   { accessorKey: "email", header: "Email" },
 *   { accessorKey: "role", header: "Role" },
 * ];
 *
 * <DataTable
 *   title="Users"
 *   data={users}
 *   columns={columns}
 *   showSearch
 *   searchKeys={["name", "email"]}
 *   showPageSize
 *   pageSize={10}
 *   onRowClick={(user) => navigate(`/users/${user.id}`)}
 * />
 * ```
 */
function DataTable<TData, TValue>({
  title,
  overline,
  loading,
  size,
  data,
  columns,
  pageSize = 10,
  pageIndex: pageIndexProp,
  totalCount,
  totalPageCount,
  manualPagination,
  onPageChange,
  onPageSizeChange,
  showPageSize = false,
  pageSizeOptions,
  searchKeys = [],
  searchPlaceholder,
  initialSorting = [],
  getRowClassName,
  showSearch = false,
  showOptions = false,
  showFilter = false,
  classNames,
  customToolbar,
  onDownload,
  downloadButtonText,
  downloadDisabled,
  customEmptyRow,
  onRowClick,
  onSearch,
  toolbarControlsAlign = "right",
  customToolbarControlsAlign = "right",
  isRowInteractive,
  onSortingChange,
  tableClassName,
  headerClassName,
  enableRowSelection = false,
  customLeftContainer,
  customRightContainer,
  editableId,
  editableFilePath = "src/App.tsx",
  editableLineNumber,
}: DataTableProps<TData, TValue>): React.JSX.Element {
  const [rowSelection, setRowSelection] = React.useState({});
  const [internalPagination, setInternalPagination] =
    React.useState<PaginationState>({
      pageIndex: 0,
      pageSize,
    });
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
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
    manualSorting: onSortingChange ? true : false,
    onSortingChange: onSortingChange
      ? (updater) => {
          const next =
            typeof updater === "function" ? updater(sorting) : updater;
          setSorting(next);
          onSortingChange(next);
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

  React.useEffect(() => {
    if (manualPagination) return;
    setInternalPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [columnFilters, table.getState().globalFilter]);

  const stickyPositionMap = React.useMemo(() => {
    const allCols = table.getAllLeafColumns();
    const leftMap: Record<string, number> = {};
    const rightMap: Record<string, number> = {};

    let leftOffset = 0;
    for (const col of allCols) {
      if (col.columnDef.meta?.sticky === "left") {
        leftMap[col.id] = leftOffset;
        leftOffset += col.getSize();
      }
    }

    let rightOffset = 0;
    for (const col of [...allCols].reverse()) {
      if (col.columnDef.meta?.sticky === "right") {
        rightMap[col.id] = rightOffset;
        rightOffset += col.getSize();
      }
    }

    return { leftMap, rightMap };
  }, [table]);

  const getStickyProps = (
    colId: string,
    sticky: "left" | "right" | undefined,
    position: "head" | "cell",
    rowIdx?: number,
    rowLen?: number
  ) => {
    const isLeft = sticky === "left";
    const isRight = sticky === "right";
    const left = isLeft ? stickyPositionMap.leftMap[colId] : undefined;
    const right = isRight ? stickyPositionMap.rightMap[colId] : undefined;

    const isLastStickyLeft =
      isLeft &&
      left === Math.max(...Object.values(stickyPositionMap.leftMap), -1);
    const isLastStickyRight =
      isRight &&
      right === Math.max(...Object.values(stickyPositionMap.rightMap), -1);

    const isTopLeft = isLeft && left === 0 && position === "head";
    const isTopRight = isRight && right === 0 && position === "head";
    const isBottomLeft =
      isLeft && left === 0 && position === "cell" && rowIdx === rowLen! - 1;
    const isBottomRight =
      isRight && right === 0 && position === "cell" && rowIdx === rowLen! - 1;

    const rounded = cn(
      isTopLeft && "rounded-tl-md",
      isTopRight && "rounded-tr-md",
      isBottomLeft && "rounded-bl-md",
      isBottomRight && "rounded-br-md"
    );

    return {
      style: { left, right },
      className: cn((isLeft || isRight) && "sticky bg-white z-[1]", rounded),
      isLastStickyLeft,
      isLastStickyRight,
    };
  };

  const renderStickyDivider = (isLeft: boolean, isRight: boolean) => {
    if (!isLeft && !isRight) return null;
    return (
      <span
        className={cn(
          "absolute top-0 h-full w-px bg-border",
          isLeft && "right-0",
          isRight && "left-0"
        )}
      />
    );
  };

  const handlePageSizeChange =
    manualPagination && onPageSizeChange
      ? onPageSizeChange
      : (value: number) => table.setPageSize(value);

  return (
    <div className="flex flex-col gap-4">
      {(title || showSearch || showOptions || onDownload || customToolbar) && (
        <div className="w-full flex items-center justify-between">
          {title && (
            <div className="flex gap-2 items-center">
              <h2 className="text-xl font-bold">
                {title}
              </h2>
            </div>
          )}
          <DataTableToolbar
            table={table}
            full={!title}
            placeholder={searchPlaceholder}
            classNames={classNames}
            showSearch={showSearch}
            showOptions={showOptions}
            onDownload={onDownload}
            customToolbar={customToolbar}
            onSearch={onSearch}
            controlsOnLeft={toolbarControlsAlign === "right"}
            customControlsOnLeft={customToolbarControlsAlign === "right"}
            downloadButtonText={downloadButtonText}
            downloadDisabled={downloadDisabled}
            customLeftContainer={customLeftContainer}
            customRightContainer={customRightContainer}
          />
        </div>
      )}

      <div className="relative rounded-md bg-white border overflow-hidden">
        {overline && (
          <p className="absolute -top-2.5 right-2 -translate-y-full text-muted-foreground text-xs font-medium select-none">
            {overline}
          </p>
        )}
        <div className={cn("overflow-auto", tableClassName)}>
          <Table>
            <TableHeader
              className={cn(
                loading && "pointer-events-none opacity-50",
                headerClassName
              )}
            >
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => {
                    const colId = header.column.id;
                    const sticky = header.column.columnDef.meta?.sticky;
                    const {
                      style,
                      className,
                      isLastStickyLeft,
                      isLastStickyRight,
                    } = getStickyProps(colId, sticky, "head");

                    if (header.column.columnDef.enableHiding) {
                      return <React.Fragment key={header.id} />;
                    }

                    return (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        style={{
                          width: header.getSize(),
                          minWidth: header.column.columnDef.minSize,
                          maxWidth: header.column.columnDef.maxSize,
                          ...style,
                        }}
                        className={cn(
                          "relative",
                          header.column.columnDef.meta?.narrow && "px-1.5",
                          header.column.columnDef.meta?.cellVariant === "dim" &&
                            "bg-state-200",
                          header.column.columnDef.meta?.headerClassName,
                          size === "xs" && "h-32 py-2 px-6 text-xs",
                          size === "sm" && "h-9 py-1 px-2.5 text-xs",
                          className
                        )}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        {renderStickyDivider(
                          isLastStickyLeft,
                          isLastStickyRight
                        )}
                        {header.column.columnDef.enableResizing && (
                          <button
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={cn(
                              "absolute p-1 right-0 top-0 h-full w-2.5 bg-transparent cursor-col-resize select-none touch-none hover:bg-muted-foreground/10",
                              header.column.getIsResizing() &&
                                "bg-muted-foreground/20"
                            )}
                            style={{
                              transform: "translateX(50%)",
                              zIndex: 10,
                            }}
                          >
                            <div
                              className={cn(
                                "rounded-sm w-full h-full bg-muted-foreground/20",
                                header.column.getIsResizing() &&
                                  "bg-muted-foreground/30"
                              )}
                            />
                          </button>
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  />
                </TableRow>
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row, rowIdx) => (
                  <TableRow
                    key={row.id}
                    // compute interactivity per row
                    data-interactive={
                      onRowClick ? isRowInteractive?.(row) ?? true : false
                    }
                    className={cn(
                      getRowClassName?.(row),
                      onRowClick &&
                        (isRowInteractive?.(row) ?? true) &&
                        "cursor-pointer hover:bg-muted/50"
                    )}
                    onClick={() => {
                      if (!onRowClick) return;
                      if (isRowInteractive && !isRowInteractive(row)) return;
                      onRowClick(row.original);
                    }}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const colId = cell.column.id;
                      const sticky = cell.column.columnDef.meta?.sticky;
                      const {
                        style,
                        className,
                        isLastStickyLeft,
                        isLastStickyRight,
                      } = getStickyProps(
                        colId,
                        sticky,
                        "cell",
                        rowIdx,
                        table.getRowModel().rows.length
                      );

                      if (cell.column.columnDef.enableHiding) {
                        return <React.Fragment key={cell.id} />;
                      }

                      return (
                        <TableCell
                          key={cell.id}
                          style={{
                            width: cell.column.getSize(),
                            minWidth: cell.column.columnDef.minSize,
                            maxWidth: cell.column.columnDef.maxSize,
                            ...style,
                          }}
                          className={cn(
                            typeof cell.column.columnDef.meta?.cellClassName ===
                              "function"
                              ? cell.column.columnDef.meta.cellClassName(
                                  row.original
                                )
                              : cell.column.columnDef.meta?.cellClassName,
                            cell.column.columnDef.meta?.narrow && "px-1.5",
                            cell.column.columnDef.meta?.cellVariant === "dim" &&
                              "bg-state-200",
                            "transition-colors duration-150 ease-in-out",
                            size === "xs" && "py-1 px-1.5 text-xs",
                            size === "sm" && "py-2 px-2.5 text-xs",
                            className
                          )}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                          {renderStickyDivider(
                            isLastStickyLeft,
                            isLastStickyRight
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  {customEmptyRow && (
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      {customEmptyRow}
                    </TableCell>
                  )}
                  {!customEmptyRow && (
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      결과가 없습니다.
                    </TableCell>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {loading && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
            <Spinner />
          </div>
        )}
      </div>

      {(table.getPageCount() > 1 || showPageSize || showFilter) && (
        <div className="flex items-center justify-between">
          {showFilter ? <DataTableFilter table={table} /> : <div />}
          <DataTablePagination
            table={table}
            showPageSize={showPageSize}
            pageSizeOptions={pageSizeOptions}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      )}
    </div>
  );
}

export {
  DataTable,
  DataTableColumnHeader,
  DataTableFilter,
  DataTableToolbar,
  DataTablePagination,
};
