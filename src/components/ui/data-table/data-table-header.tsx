"use client";

import React from "react";

import { cn } from "@/lib/commerce-sdk";

type DataTableHeaderProps = {
  title: React.ReactNode;
  overline?: string;
  className?: string;
};

function DataTableHeader({
  title,
  overline,
  className,
}: DataTableHeaderProps): React.JSX.Element {
  return (
    <div className={cn("relative", className)}>
      {overline && (
        <p className="absolute -top-2.5 right-2 -translate-y-full text-text-secondary text-xs font-medium select-none">
          {overline}
        </p>
      )}
      <div className="flex gap-0.5 items-center">
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
    </div>
  );
}

DataTableHeader.displayName = "DataTableHeader";

export { DataTableHeader };
export type { DataTableHeaderProps };
