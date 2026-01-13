"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { JSX } from "react";
import { useMemo } from "react";

import { AlertCircle, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/commerce-sdk";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import {
  ColumnDate,
  ColumnNone,
  ColumnNumber,
  ColumnPrice,
  ColumnValue,
} from "@/components/ui/column";

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

export type DynamicDataTableProps = {
  title: string;
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
};

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
}: DynamicDataTableProps): JSX.Element => {
  const safeData = Array.isArray(data) ? data : [];

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
            <div className={cn("flex items-center gap-2", alignClass)}>
              <Progress
                className="w-[56px]"
                value={(value / 100) * 100}
                indicatorColor={col.progress.color || "#2a9d90"}
              />
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
                style={{ backgroundColor: badge.color }}
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
                링크
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

  return (
    <DataTable
      title={title}
      overline={overline}
      size={size}
      data={safeData}
      columns={columnDefs}
      pageSize={pageSize}
      showPageSize={showPageSize}
      showSearch={showSearch}
      searchKeys={searchKeys}
      searchPlaceholder={searchPlaceholder}
      showOptions={showOptions}
    />
  );
};
