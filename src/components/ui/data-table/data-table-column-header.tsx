import type { Column } from "@tanstack/react-table";
import React from "react";
import { ArrowDown, ArrowUp, EyeOff, Info } from "lucide-react";

import { cn } from "@/lib/commerce-sdk";

import { Select, Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@viralpick/synapse";
import { nl2br } from "@/utils/nl2br";
import { useTranslation } from "@/hooks/useTranslation";

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
  textAlign?: "left" | "center" | "right";
};

function DataTableColumnHeader<TData, TValue>({
  column,
  prefix: _prefix,
  size,
  title,
  tooltip,
  tooltipIcon,
  className,
  textAlign = "left",
  disableSort: _disableSort = false,
  disableHiding = false,
}: DataTableColumnHeaderProps<TData, TValue>): React.JSX.Element {
  const t = useTranslation();

  if (!column.getCanSort()) {
    return <div className={cn("flex w-full text-xs", className)}>{nl2br(title)}</div>;
  }

  return (
    <div
      className={cn(
        "flex w-full gap-0.5 py-1",
        size === "sm" && "text-xs",
        className
      )}
    >
      <Select
        className={cn("w-full", textAlign === "right" && "justify-end", textAlign === "center" && "justify-center", textAlign === "left" && "justify-start")}
        variant="inline"
        size={size === "sm" ? "sm" : "md"}
        side="left"
        placeholder={title}
        options={[
          {
            value: "asc",
            label: t.dataTable.sortAsc,
            leadIcon: <ArrowUp className="size-4" />,
          },
          {
            value: "desc",
            label: t.dataTable.sortDesc,
            leadIcon: <ArrowDown className="size-4" />,
          },
          ...(!disableHiding
            ? [
                {
                  value: "hide",
                  label: t.dataTable.hide,
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
