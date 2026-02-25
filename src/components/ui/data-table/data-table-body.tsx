"use client";

import type { Row } from "@tanstack/react-table";
import React from "react";
import { flexRender } from "@tanstack/react-table";

import { cn } from "@/lib/commerce-sdk";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Spinner,
} from "@enhans/synapse";
import { useDataTableContext } from "./data-table-context";
import { getStickyProps } from "./data-table-sticky";
import { useTranslation } from "@/hooks/useTranslation";

type DataTableBodyProps<TData = unknown> = {
  loading?: boolean;
  emptyState?: React.ReactNode;
  getRowClassName?: (row: Row<TData>) => string;
  tableClassName?: string;
  headerClassName?: string;
  className?: string;
};

function DataTableBody<TData = unknown>({
  loading,
  emptyState,
  getRowClassName,
  tableClassName,
  headerClassName,
  className,
}: DataTableBodyProps<TData>): React.JSX.Element {
  const t = useTranslation();
  const {
    table,
    size,
    onRowClick,
    isRowInteractive,
    stickyPositionMap,
    queryId,
    queryContent,
  } = useDataTableContext<TData>();

  const columns = table.getAllLeafColumns();
  const rows = table.getRowModel().rows;

  const renderStickyDivider = (isLeft: boolean, isRight: boolean) => {
    if (!isLeft && !isRight) return null;
    return (
      <span
        className={cn(
          "absolute top-0 h-full w-px bg-border-100",
          isLeft && "right-0",
          isRight && "left-0"
        )}
      />
    );
  };

  return (
    <div className={cn("relative rounded-md bg-white border overflow-hidden", className)}>
      <div
        className={cn("overflow-auto", tableClassName)}
        data-query-id={queryId}
        data-query-content={queryContent}
      >
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
                  const stickyInfo = getStickyProps(
                    stickyPositionMap,
                    colId,
                    sticky,
                    "head"
                  );

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
                        ...stickyInfo.style,
                      }}
                      className={cn(
                        "relative",
                        header.column.columnDef.meta?.narrow && "px-1.5",
                        header.column.columnDef.meta?.cellVariant === "dim" &&
                          "bg-state-200",
                        header.column.columnDef.meta?.headerClassName,
                        size === "xs" && "h-8 py-0.5 px-1.5 text-xs",
                        size === "sm" && "h-9 py-1 px-2.5 text-xs",
                        stickyInfo.isSticky && "sticky bg-white z-[1]",
                        stickyInfo.isTopLeft && "rounded-tl-md",
                        stickyInfo.isTopRight && "rounded-tr-md"
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      {renderStickyDivider(
                        stickyInfo.isLastStickyLeft,
                        stickyInfo.isLastStickyRight
                      )}
                      {header.column.columnDef.enableResizing && (
                        <button
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={cn(
                            "absolute p-px right-0 top-0 h-full w-0.5 bg-transparent cursor-col-resize select-none touch-none hover:bg-text-secondary/10",
                            header.column.getIsResizing() &&
                              "bg-text-secondary/20"
                          )}
                          style={{
                            transform: "translateX(50%)",
                            zIndex: 10,
                          }}
                        >
                          <div
                            className={cn(
                              "rounded-sm w-full h-full bg-text-secondary/20",
                              header.column.getIsResizing() &&
                                "bg-text-secondary/30"
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
            ) : rows.length ? (
              rows.map((row, rowIdx) => (
                <TableRow
                  key={row.id}
                  data-interactive={
                    onRowClick
                      ? (isRowInteractive?.(row) ?? true)
                      : false
                  }
                  className={cn(
                    getRowClassName?.(row as Row<TData>),
                    onRowClick &&
                      (isRowInteractive?.(row) ?? true) &&
                      "cursor-pointer hover:bg-background-100/50"
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
                    const stickyInfo = getStickyProps(
                      stickyPositionMap,
                      colId,
                      sticky,
                      "cell",
                      rowIdx,
                      rows.length
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
                          ...stickyInfo.style,
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
                          size === "xs" && "py-px px-0.5 text-xs",
                          size === "sm" && "py-2 px-2.5 text-xs",
                          stickyInfo.isSticky && "sticky bg-white z-[1]",
                          stickyInfo.isBottomLeft && "rounded-bl-md",
                          stickyInfo.isBottomRight && "rounded-br-md"
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                        {renderStickyDivider(
                          stickyInfo.isLastStickyLeft,
                          stickyInfo.isLastStickyRight
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {emptyState ?? t.dataTable.noResults}
                </TableCell>
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
  );
}

DataTableBody.displayName = "DataTableBody";

export { DataTableBody };
export type { DataTableBodyProps };
