"use client";

import React from "react";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/commerce-sdk";

import { Button, Input } from "@enhans/synapse";
import { useDataTableContext } from "./data-table-context";

type DataTableSearchProps = {
  placeholder?: string;
  className?: string;
};

function DataTableSearch({
  placeholder = "Search...",
  className,
}: DataTableSearchProps): React.JSX.Element {
  const { table, onSearch } = useDataTableContext();
  const globalFilter = (table.getState().globalFilter as string) ?? "";
  const isFiltered = table.getState().columnFilters.length > 0;

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    table.setGlobalFilter(value);
    onSearch?.(value);
  };

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <Input
        size="sm"
        leadIcon={<Search className="size-4" />}
        placeholder={placeholder}
        value={globalFilter}
        onChange={handleSearch}
      />
      {isFiltered && (
        <Button
          buttonStyle="secondary"
          buttonType="icon"
          size="sm"
          onClick={() => table.resetColumnFilters()}
        >
          <X />
        </Button>
      )}
    </div>
  );
}

DataTableSearch.displayName = "DataTableSearch";

export { DataTableSearch };
export type { DataTableSearchProps };
