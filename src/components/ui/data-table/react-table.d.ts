import type { Column } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface ColumnMeta<TData extends Record<string, any>> {
    sticky?: "left" | "right";
    title?: string;
    narrow?: boolean;
    cellVariant?: string;
    headerClassName?: string | ((column: Column<TData, unknown>) => string);
    cellClassName?: string | ((row: TData) => string);
    filterLabel?: string;
  }
}