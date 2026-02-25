"use client";

import type { Row, Table } from "@tanstack/react-table";
import React from "react";

import type { DataTableSize } from "./types";

type StickyPositionMap = {
  leftMap: Record<string, number>;
  rightMap: Record<string, number>;
};

type DataTableContextValue<TData = unknown> = {
  table: Table<TData>;
  size: DataTableSize;
  searchKeys: (keyof TData)[];
  onSearch?: (searchTerm: string) => void;
  onRowClick?: (row: TData) => void;
  isRowInteractive?: (row: Row<TData>) => boolean;
  handlePageSizeChange: (pageSize: number) => void;
  stickyPositionMap: StickyPositionMap;
  queryId?: string;
  queryContent?: string;
};

const DataTableContext = React.createContext<DataTableContextValue | null>(null);

function DataTableProvider({
  value,
  children,
}: {
  value: DataTableContextValue;
  children: React.ReactNode;
}) {
  return (
    <DataTableContext.Provider value={value}>
      {children}
    </DataTableContext.Provider>
  );
}

function useDataTableContext<TData = unknown>(): DataTableContextValue<TData> {
  const context = React.useContext(DataTableContext);
  if (!context) {
    throw new Error(
      "useDataTableContext must be used within a <DataTable /> component."
    );
  }
  return context as DataTableContextValue<TData>;
}

export { DataTableProvider, useDataTableContext };
export type { DataTableContextValue, StickyPositionMap };
