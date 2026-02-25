import type { Table } from "@tanstack/react-table";

function escapeCsv(val: unknown): string {
  const str = val == null ? "" : String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a CSV Blob with UTF-8 BOM from visible table data.
 */
function buildCsvBlob<TData>(table: Table<TData>): Blob {
  const visibleColumns = table.getVisibleLeafColumns();
  const rows = table.getRowModel().rows;

  const headers = visibleColumns.map(
    (col) => escapeCsv((col.columnDef.meta?.title as string) ?? col.id)
  );

  const dataRows = rows.map((row) =>
    visibleColumns.map((col) => escapeCsv(row.getValue(col.id))).join(",")
  );

  const csv = [headers.join(","), ...dataRows].join("\n");
  const bom = "\uFEFF";
  return new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
}

/**
 * Trigger a browser download of a CSV blob.
 */
function triggerCsvDownload(blob: Blob, fileNamePrefix: string): void {
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${fileNamePrefix}-${date}.csv`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export { buildCsvBlob, triggerCsvDownload };
