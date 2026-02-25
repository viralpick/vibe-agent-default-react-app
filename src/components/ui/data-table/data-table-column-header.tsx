"use client";

import type { Column } from "@tanstack/react-table";
import React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff, Info } from "lucide-react";

import { cn } from "@/lib/commerce-sdk";

import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@enhans/synapse";
import { nl2br } from "@/utils/nl2br";
import { useTranslation } from "@/hooks/useTranslation";

import type { DataTableSize } from "./types";

type DataTableColumnHeaderProps<TData, TValue> = Omit<
  React.ComponentProps<"div">,
  "prefix"
> & {
  column: Column<TData, TValue>;
  size?: DataTableSize;
  title: string;
  tooltip?: string;
  tooltipIcon?: React.JSX.Element;
  disableSort?: boolean;
  disableHiding?: boolean;
  textAlign?: "left" | "center" | "right";
};

function DataTableColumnHeader<TData, TValue>({
  column,
  size,
  title,
  tooltip,
  tooltipIcon,
  className,
  textAlign = "left",
  disableSort = false,
  disableHiding = false,
}: DataTableColumnHeaderProps<TData, TValue>): React.JSX.Element {
  const t = useTranslation();
  const sorted = column.getIsSorted();

  if (!column.getCanSort()) {
    return (
      <div className={cn("flex w-full text-xs", className)}>{nl2br(title)}</div>
    );
  }

  const SortIcon =
    sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ChevronsUpDown;

  return (
    <div
      className={cn(
        "flex w-full items-center gap-0.5",
        size === "sm" && "text-xs",
        textAlign === "right" && "justify-end",
        textAlign === "center" && "justify-center",
        className,
      )}
    >
      {!disableSort && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-1 hover:text-text-primary transition-colors -ml-1 px-1 py-0.5 rounded-sm hover:bg-background-100",
                sorted && "text-text-primary",
              )}
            >
              <span className="text-xs font-medium">{title}</span>
              <SortIcon className="size-3.5 shrink-0 text-text-secondary" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0.5" sideOffset={4}>
            <div className="flex flex-col gap-0.5">
              <Button
                buttonStyle="ghost"
                size="sm"
                className="flex items-center justify-between"
                tailIcon={<ArrowUp />}
                onClick={() => {
                  if (sorted === "asc") column.clearSorting();
                  else column.toggleSorting(false);
                }}
              >
                {t.dataTable.sortAsc}
              </Button>
              <Button
                buttonStyle="ghost"
                size="sm"
                className="flex items-center justify-between"
                tailIcon={<ArrowDown />}
                onClick={() => {
                  if (sorted === "desc") column.clearSorting();
                  else column.toggleSorting(true);
                }}
              >
                {t.dataTable.sortDesc}
              </Button>
              {!disableHiding && (
                <Button
                  buttonStyle="ghost"
                  size="sm"
                  className="flex items-center justify-between"
                  tailIcon={<EyeOff />}
                  onClick={() => column.toggleVisibility(false)}
                >
                  {t.dataTable.hide}
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
      {tooltip && (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                {tooltipIcon ?? (
                  <Info className={cn("size-3", size === "sm" && "size-2")} />
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

DataTableColumnHeader.displayName = "DataTableColumnHeader";

export { DataTableColumnHeader };
export type { DataTableColumnHeaderProps };
