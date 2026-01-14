import type { Column } from "@tanstack/react-table";
import React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff, Info } from "lucide-react";

import { cn } from "@/lib/commerce-sdk";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
        "flex items-center gap-2",
        size === "sm" && "text-xs",
        className
      )}
    >
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "-ml-12 -mr-12 h-32 data-[state=open]:bg-accent gap-4",
              size === "sm" &&
                "h-6 -ml-1.5 -mr-1.5 px-2 text-xs gap-0.5 [&_svg:not([class*='size-'])]:size-3"
            )}
          >
            {prefix && prefix}
            <span>{nl2br(title)}</span>
            {tooltip && (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      {tooltipIcon && tooltipIcon}
                      {!tooltipIcon && (
                        <Info
                          className={cn("size-3", size === "sm" && "size-2")}
                        />
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{tooltip}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {!disableSort &&
              (column.getIsSorted() === "desc" ? (
                <ArrowDown />
              ) : column.getIsSorted() === "asc" ? (
                <ArrowUp />
              ) : (
                <ChevronsUpDown />
              ))}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onClick={() => {
              if (column.getIsSorted() === "asc") {
                column.clearSorting();
              } else {
                column.toggleSorting(false);
              }
            }}
          >
            <ArrowUp className="h-3.5 w-3.5 text-muted-foreground/70" />
            Asc
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              if (column.getIsSorted() === "desc") {
                column.clearSorting();
              } else {
                column.toggleSorting(true);
              }
            }}
          >
            <ArrowDown className="h-3.5 w-3.5 text-muted-foreground/70" />
            Desc
          </DropdownMenuItem>
          {!disableHiding && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
                <EyeOff className="h-3.5 w-3.5 text-muted-foreground/70" />
                Hide
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export { DataTableColumnHeader };
