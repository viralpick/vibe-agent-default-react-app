"use client";

import React from "react";
import { Download } from "lucide-react";

import { cn } from "@/lib/commerce-sdk";

import { Button } from "@enhans/synapse";
import { useDataTableContext } from "./data-table-context";
import { buildCsvBlob, triggerCsvDownload } from "./data-table-download-utils";

type DataTableDownloadProps = {
  onDownload?: () => void;
  buttonText?: string;
  disabled?: boolean;
  fileNamePrefix?: string;
  className?: string;
};

function DataTableDownload({
  onDownload,
  buttonText,
  disabled,
  fileNamePrefix = "data",
  className,
}: DataTableDownloadProps): React.JSX.Element {
  const { table } = useDataTableContext();

  const handleDownload = React.useCallback(() => {
    if (onDownload) {
      onDownload();
      return;
    }
    const blob = buildCsvBlob(table);
    triggerCsvDownload(blob, fileNamePrefix);
  }, [onDownload, table, fileNamePrefix]);

  return (
    <Button
      buttonStyle="secondary"
      onClick={handleDownload}
      className={cn("h-8", !buttonText && "px-0.5!", className)}
      disabled={disabled}
    >
      <Download /> {buttonText}
    </Button>
  );
}

DataTableDownload.displayName = "DataTableDownload";

export { DataTableDownload };
export type { DataTableDownloadProps };
