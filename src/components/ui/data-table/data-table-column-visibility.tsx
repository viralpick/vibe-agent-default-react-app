"use client";

import React from "react";
import { Settings } from "lucide-react";

import { cn } from "@/lib/commerce-sdk";

import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@enhans/synapse";
import { useDataTableContext } from "./data-table-context";

type DataTableColumnVisibilityProps = {
  className?: string;
};

function DataTableColumnVisibility({
  className,
}: DataTableColumnVisibilityProps): React.JSX.Element {
  const { table } = useDataTableContext();

  const columns = table
    .getAllColumns()
    .filter(
      (column) =>
        typeof column.accessorFn !== "undefined" && column.getCanHide(),
    );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          buttonStyle="secondary"
          buttonType="icon"
          size="sm"
          className={className}
        >
          <Settings className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-1" sideOffset={4}>
        <div className="flex flex-col gap-0.5">
          {columns.map((column) => (
            <label
              key={column.id}
              className={cn(
                "flex items-center gap-2 px-1 py-0.5 rounded-sm text-caption-1 cursor-pointer hover:bg-background-100",
                !column.getIsVisible() && "text-text-secondary",
              )}
            >
              <input
                type="checkbox"
                checked={column.getIsVisible()}
                onChange={(e) => column.toggleVisibility(e.target.checked)}
                className="accent-primary"
              />
              {(column.columnDef.meta?.title as string) ?? column.id}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

DataTableColumnVisibility.displayName = "DataTableColumnVisibility";

export { DataTableColumnVisibility };
export type { DataTableColumnVisibilityProps };
