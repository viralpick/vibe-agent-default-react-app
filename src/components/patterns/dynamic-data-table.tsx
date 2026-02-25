"use client";

/**
 * @fileoverview Dynamic Data Table component with metadata-driven column rendering.
 * Automatically formats cells based on column type definitions.
 *
 * @module patterns/dynamic-data-table
 */

import type { ColumnDef } from "@tanstack/react-table";
import type { JSX } from "react";
import { useMemo } from "react";

import { AlertCircle, CheckCircle2 } from "lucide-react";

import { cn, getColorClass } from "@/lib/commerce-sdk";

import { Badge, Progress } from "@enhans/synapse";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import {
  ColumnDate,
  ColumnNone,
  ColumnNumber,
  ColumnPrice,
  ColumnValue,
} from "@/components/ui/column";
import { normalizeNumericValue } from "./data-utils";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Column metadata definition for DynamicDataTable
 * @property key - Data field key to access from row data
 * @property label - Display header label
 * @property type - Column type for automatic formatting
 * @property align - Text alignment
 * @property width - Column width in pixels
 * @property badgeMap - Status-to-badge mapping for badge columns
 */
export type ColumnMeta = {
  key: string;
  label?: string;
  tooltip?: string;
  type?:
    | "text"
    | "number"
    | "currency"
    | "percent"
    | "date"
    | "url"
    | "badge"
    | "progress"
    | "status";
  align?: "left" | "center" | "right";
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  unit?: string;
  colorBySign?: boolean;
  badgeMap?: { [value: string]: { label: string; color: string } };
  defaultBadge?: { color: string };
  progress?: { color?: string };
  showValue?: boolean;
  valueFormat?: "number" | "currency" | "percent";
  currency?: string;
  dateFormat?: string;
  statusIcons?: {
    [value: string]: { icon: string; color?: string; label?: string };
  };
};

/**
 * Props for DynamicDataTable component
 */
export type DynamicDataTableProps = {
  title: string | React.ReactNode;
  overline?: string;
  size?: "default" | "sm";
  columns: ColumnMeta[];
  data: Record<string, string | number | boolean>[];
  pageSize?: number;
  showPageSize?: boolean;
  showSearch?: boolean;
  showOptions?: boolean;
  searchKeys?: string[];
  searchPlaceholder?: string;
  /** Show built-in CSV download button */
  showDownload?: boolean;
  /** Query ID for query edit mode (optional) */
  queryId?: string;
  /** Query content for query edit mode (optional) */
  queryContent?: string;
};

/**
 * @component DynamicDataTable
 * @description A data table that automatically renders cells based on column metadata.
 * Uses the DataTable composition API internally.
 */
export const DynamicDataTable = ({
  title,
  overline,
  size,
  columns,
  data,
  pageSize,
  showPageSize,
  showSearch,
  showOptions,
  searchKeys,
  searchPlaceholder,
  queryId,
  queryContent,
}: DynamicDataTableProps): JSX.Element => {
  const t = useTranslation();

  // Normalize data: convert object values (like { review_id: 4 }) to numbers
  const safeData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.map((row) => {
      const normalizedRow: Record<string, string | number | boolean> = {};
      for (const [key, value] of Object.entries(row)) {
        if (
          value !== null &&
          typeof value === "object" &&
          !Array.isArray(value)
        ) {
          normalizedRow[key] = normalizeNumericValue(value);
        } else {
          normalizedRow[key] = value as string | number | boolean;
        }
      }
      return normalizedRow;
    });
  }, [data]);

  const percentFormatter = useMemo(
    () =>
      new Intl.NumberFormat("ko-KR", {
        maximumFractionDigits: 2,
      }),
    []
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columnDefs: ColumnDef<any>[] = columns.map((col) => {
    const alignClass =
      col.align === "right"
        ? "justify-end text-right"
        : col.align === "center"
        ? "justify-center text-center"
        : "";

    return {
      id: col.key,
      accessorKey: col.key,
      size: col.width ?? 120,
      minSize: col.minWidth ?? 100,
      maxSize: col.maxWidth ?? 160,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={col.label ?? col.key}
          tooltip={col?.tooltip}
          className={alignClass}
        />
      ),
      cell: ({ row }) => {
        const value = row.original[col.key];

        if (
          col.type === "progress" &&
          typeof value === "number" &&
          col.progress
        ) {
          return (
            <div className={cn("flex items-center gap-0.5", alignClass)}>
              <Progress
                value={value}
                className="w-[56px] flex-row items-center gap-1"
              >
                <Progress.Bar
                  indicatorClassName={
                    col.progress.color
                      ? getColorClass(col.progress.color)
                      : "bg-[#2a9d90]"
                  }
                />
              </Progress>
              {col.showValue && (
                <span
                  className={cn("text-sm", size === "sm" && "text-xs")}
                  style={{
                    color: col.progress.color || "#2a9d90",
                  }}
                >
                  {col.valueFormat === "percent"
                    ? `${value.toFixed(1)}%`
                    : col.valueFormat === "currency"
                    ? value.toLocaleString()
                    : value}
                  {col.unit ?? ""}
                </span>
              )}
            </div>
          );
        }

        if (col.type === "badge" && col.badgeMap) {
          const badge = col.badgeMap[value as string] ?? {
            label: String(value),
            color: col.defaultBadge?.color || "#cbd5e1",
          };
          return (
            <div className={cn("flex items-center", alignClass)}>
              <Badge
                className={cn("text-sm", size === "sm" && "text-xs")}
                color={badge.color}
              >
                {badge.label}
              </Badge>
            </div>
          );
        }

        if (col.type === "status") {
          return (
            <div className="flex items-center justify-center">
              {value === "normal" && (
                <CheckCircle2
                  size={size === "sm" ? 20 : 24}
                  className="text-[#2a9d90]"
                />
              )}
              {value === "warning" && (
                <AlertCircle
                  size={size === "sm" ? 20 : 24}
                  className="text-red-600"
                />
              )}
            </div>
          );
        }

        if (typeof value === "number") {
          let signClass = "";
          if (col.colorBySign) {
            if (value > 0) signClass = "text-[#2a9d90]";
            else if (value < 0) signClass = "text-red-600";
          }
          const finalClass = cn(alignClass, signClass);
          if (col.type === "currency")
            return (
              <ColumnPrice
                value={value}
                className={finalClass}
                currency={col.currency}
              />
            );
          if (col.type === "percent")
            return (
              <div className={cn(finalClass, "text-right")}>
                {percentFormatter.format(value)}%
              </div>
            );
          return <ColumnNumber value={value} className={finalClass} />;
        }

        if (typeof value === "string") {
          if (/^https?:\/\//.test(value)) {
            return (
              <a
                href={value}
                target="_blank"
                className={`text-blue-500 underline ${alignClass}`}
              >
                {t.table.link}
              </a>
            );
          }
          if (!isNaN(Date.parse(value)) && col.type === "date") {
            return (
              <ColumnDate
                value={value}
                className={alignClass}
                format={col.dateFormat}
              />
            );
          }
          return <ColumnValue value={value} className={alignClass} />;
        }

        return <ColumnNone className={alignClass} />;
      },
    };
  });

  const fileNamePrefix = typeof title === "string" ? title : "data";

  return (
    <DataTable
      data={safeData}
      columns={columnDefs}
      pageSize={pageSize}
      searchKeys={searchKeys as (keyof Record<string, unknown>)[]}
      size={size}
      queryId={queryId}
      queryContent={queryContent}
    >
      {title && <DataTable.Header title={title} overline={overline} />}
      <DataTable.Toolbar>
        <DataTable.Toolbar.Left>
          {showSearch && (
            <DataTable.Search placeholder={searchPlaceholder} />
          )}
          <DataTable.Filter />
          {showOptions && <DataTable.ColumnVisibility />}
          <DataTable.Download fileNamePrefix={fileNamePrefix} />
        </DataTable.Toolbar.Left>
      </DataTable.Toolbar>
      <DataTable.Body />
      <DataTable.Pagination showPageSize={showPageSize} />
    </DataTable>
  );
};
