import type { Column } from "@tanstack/react-table";
import React from "react";
import { ArrowDown, ArrowUp, EyeOff, Info } from "lucide-react";

import { cn } from "@/lib/commerce-sdk";

import { Select } from "@/components/ui/dropdown";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { nl2br } from "@/utils/nl2br";

type DataTableColumnHeaderProps<TData, TValue> = Omit<
  React.ComponentProps<"div">,
  "prefix"
> & {
  column: Column<TData, TValue>;
  prefix?: React.JSX.Element;
  size?: "default" | "sm" | "xs";
  title: string;
  tooltip?: string;
  tooltipIcon?: React.JSX.Element;
  disableSort?: boolean;
  disableHiding?: boolean;
};

function DataTableColumnHeader<TData, TValue>({
  column,
  prefix,
  size,
  title,
  tooltip,
  tooltipIcon,
  className,
  disableSort = false,
  disableHiding = false,
}: DataTableColumnHeaderProps<TData, TValue>): React.JSX.Element {
  if (!column.getCanSort()) {
    return <div className={cn("flex text-xs", className)}>{nl2br(title)}</div>;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-0.5",
        size === "sm" && "text-xs",
        className
      )}
    >
      <Select
        variant="inline"
        size={size === "sm" ? "sm" : "md"}
        side="left"
        className={cn(
          "-ml-3 -mr-3 h-8 gap-1",
          size === "sm" && "h-1.5 -ml-1.5 -mr-1.5 px-2 text-xs gap-0.5"
        )}
        placeholder={title}
        options={[
          {
            value: "asc",
            label: "Asc",
            leadIcon: <ArrowUp className="size-4" />,
          },
          {
            value: "desc",
            label: "Desc",
            leadIcon: <ArrowDown className="size-4" />,
          },
          ...(!disableHiding
            ? [
                {
                  value: "hide",
                  label: "Hide",
                  leadIcon: <EyeOff className="size-4" />,
                },
              ]
            : []),
        ]}
        value={column.getIsSorted() || ""}
        onValueChange={(val) => {
          if (val === "asc") {
            if (column.getIsSorted() === "asc") {
              column.clearSorting();
            } else {
              column.toggleSorting(false);
            }
          } else if (val === "desc") {
            if (column.getIsSorted() === "desc") {
              column.clearSorting();
            } else {
              column.toggleSorting(true);
            }
          } else if (val === "hide") {
            column.toggleVisibility(false);
          }
        }}
      />
      {tooltip && (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                {tooltipIcon && tooltipIcon}
                {!tooltipIcon && (
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

export { DataTableColumnHeader };
