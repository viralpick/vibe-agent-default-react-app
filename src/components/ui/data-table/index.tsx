/**
 * @fileoverview DataTable compound component with composition pattern.
 * Provides sorting, filtering, pagination, search, and column visibility features.
 *
 * @module ui/data-table
 *
 * @example
 * ```tsx
 * <DataTable data={users} columns={columns} searchKeys={["name", "email"]}>
 *   <DataTable.Header title="Users" />
 *   <DataTable.Toolbar>
 *     <DataTable.Toolbar.Left>
 *       <DataTable.Search placeholder="Search..." />
 *     </DataTable.Toolbar.Left>
 *     <DataTable.Toolbar.Right>
 *       <DataTable.ColumnVisibility />
 *       <DataTable.Download />
 *     </DataTable.Toolbar.Right>
 *   </DataTable.Toolbar>
 *   <DataTable.Body />
 *   <DataTable.Pagination showPageSize />
 * </DataTable>
 * ```
 */

import { DataTableRoot } from "./data-table-root";
import { DataTableHeader } from "./data-table-header";
import { DataTableToolbar } from "./data-table-toolbar";
import { DataTableSearch } from "./data-table-search";
import { DataTableColumnVisibility } from "./data-table-column-visibility";
import { DataTableDownload } from "./data-table-download";
import { DataTableBody } from "./data-table-body";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableFilter } from "./data-table-filter";
import { DataTableColumnHeader } from "./data-table-column-header";
import { useDataTableContext } from "./data-table-context";

const DataTable = Object.assign(DataTableRoot, {
  Header: DataTableHeader,
  Toolbar: DataTableToolbar,
  Search: DataTableSearch,
  ColumnVisibility: DataTableColumnVisibility,
  Download: DataTableDownload,
  Body: DataTableBody,
  Pagination: DataTablePagination,
  Filter: DataTableFilter,
});

export { DataTable, DataTableColumnHeader, useDataTableContext };
export type { DataTableSize } from "./types";
