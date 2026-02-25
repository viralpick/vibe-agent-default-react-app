"use client";

import React from "react";

import { cn } from "@/lib/commerce-sdk";

type DataTableToolbarProps = {
  children: React.ReactNode;
  className?: string;
};

function DataTableToolbar({
  children,
  className,
}: DataTableToolbarProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-0.5 w-full",
        className
      )}
    >
      {children}
    </div>
  );
}

DataTableToolbar.displayName = "DataTableToolbar";

type DataTableToolbarSlotProps = {
  children: React.ReactNode;
  className?: string;
};

function ToolbarLeft({
  children,
  className,
}: DataTableToolbarSlotProps): React.JSX.Element {
  return (
    <div className={cn("flex items-center gap-0.5 flex-1", className)}>
      {children}
    </div>
  );
}

ToolbarLeft.displayName = "DataTableToolbar.Left";

function ToolbarRight({
  children,
  className,
}: DataTableToolbarSlotProps): React.JSX.Element {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {children}
    </div>
  );
}

ToolbarRight.displayName = "DataTableToolbar.Right";

const DataTableToolbarWithSlots = Object.assign(DataTableToolbar, {
  Left: ToolbarLeft,
  Right: ToolbarRight,
});

export { DataTableToolbarWithSlots as DataTableToolbar };
export type { DataTableToolbarProps, DataTableToolbarSlotProps };
