import type { Column, Table } from "@tanstack/react-table";
import type { ColumnFiltersState } from "@tanstack/react-table";
import type {
  FilterOperator,
  FilterValue,
} from "@/components/ui/data-table/types";
import React from "react";
import { Filter as FilterIcon, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/seperator";
import { filterOperators } from "@/components/ui/data-table/types";
import { Select } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/commerce-sdk";

type DataTableFilterProps<TData> = {
  table: Table<TData>;
};

function DataTableFilter<TData>({
  table,
}: DataTableFilterProps<TData>): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const filters = table.getState().columnFilters;

  const setFilters = (updater: React.SetStateAction<ColumnFiltersState>) => {
    table.setColumnFilters(updater);
  };

  const filterableColumns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanFilter());

  const handleAddFilter = () => {
    if (filterableColumns.length > 0) {
      const defaultColumnId = filterableColumns[0].id;
      const defaultOperator = filterOperators[0].value;
      setFilters((prev) => [
        ...prev,
        {
          id: defaultColumnId,
          value: { operator: defaultOperator, value: "" },
        },
      ]);
    }
  };

  const handleUpdateFilter = (
    index: number,
    updatedItem: { id: string; operator: FilterOperator; value: string }
  ) => {
    setFilters((prev) =>
      prev.map((filter, i) => {
        if (i === index) {
          return {
            id: updatedItem.id,
            value: { operator: updatedItem.operator, value: updatedItem.value },
          };
        }
        return filter;
      })
    );
  };

  const handleRemoveFilter = (index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button buttonStyle="secondary" buttonType="icon" size="sm">
          <FilterIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[520px]"
        align="start"
        side="bottom"
        sideOffset={8}
      >
        <div className="p-1 flex flex-col gap-1">
          {filters.map((filter, index) => (
            <DataTableFilterItem
              key={index}
              item={{
                id: filter.id,
                operator: (filter.value as FilterValue)?.operator ?? "includes",
                value: (filter.value as FilterValue)?.value ?? "",
              }}
              onUpdate={(item) => handleUpdateFilter(index, item)}
              onRemove={() => handleRemoveFilter(index)}
              filterableColumns={filterableColumns}
            />
          ))}
          <Button
            buttonStyle="ghost"
            size="sm"
            onClick={handleAddFilter}
            className="text-primary hover:text-primary"
          >
            <Plus className="h-4 w-4 mr-0.5" />
            Add
          </Button>
        </div>
        <Separator />
        <div className="p-0.5 flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {table.getFilteredRowModel().rows.length} results
          </p>
          <Button
            buttonStyle="tertiary"
            className="text-destructive hover:text-destructive"
            onClick={() => table.resetColumnFilters()}
          >
            필터 초기화
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type FilterItemProps = {
  id: string;
  operator: FilterOperator;
  value: string;
};

type DataTableFilterItemProps<TData> = {
  item: FilterItemProps;
  onUpdate: (item: FilterItemProps) => void;
  onRemove: () => void;
  filterableColumns: Column<TData, unknown>[];
};

function DataTableFilterItem<TData>({
  item,
  onUpdate,
  onRemove,
  filterableColumns,
}: DataTableFilterItemProps<TData>): React.JSX.Element {
  const handleColumnChange = (id: string) => {
    onUpdate({ ...item, id });
  };

  const handleOperatorChange = (operator: FilterOperator) => {
    onUpdate({ ...item, operator });
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...item, value: e.target.value });
  };

  const showInput = !["isEmpty", "isNotEmpty"].includes(item.operator);

  return (
    <div className="flex items-center gap-0.5 py-0.25">
      <span className="text-sm text-muted-foreground">Where</span>
      <Select
        value={item.id}
        onValueChange={handleColumnChange}
        className="w-[150px]"
        options={filterableColumns.map((col) => ({
          value: col.id,
          label: (col.columnDef.meta?.filterLabel as string) ??
            (typeof col.columnDef.header === "string"
              ? col.columnDef.header
              : col.id),
        }))}
      />
      <Select
        value={item.operator}
        onValueChange={(val) => handleOperatorChange(val as FilterOperator)}
        className="w-[120px]"
        options={filterOperators.map((op) => ({
          value: op.value,
          label: op.label,
        }))}
      />
      <Input
        placeholder="값 입력"
        value={item.value}
        onChange={handleValueChange}
        className={cn("w-[150px] h-3", !showInput && "invisible")}
      />
      <Button buttonStyle="ghost" buttonType="icon" size="sm" onClick={onRemove}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export { DataTableFilter };
