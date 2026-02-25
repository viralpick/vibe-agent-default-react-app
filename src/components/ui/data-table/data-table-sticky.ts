import type { Table } from "@tanstack/react-table";
import React from "react";

import type { StickyPositionMap } from "./data-table-context";

/**
 * Computes left/right sticky offsets from column metadata.
 */
function useStickyColumns<TData>(table: Table<TData>): StickyPositionMap {
  return React.useMemo(() => {
    const allCols = table.getAllLeafColumns();
    const leftMap: Record<string, number> = {};
    const rightMap: Record<string, number> = {};

    let leftOffset = 0;
    for (const col of allCols) {
      if (col.columnDef.meta?.sticky === "left") {
        leftMap[col.id] = leftOffset;
        leftOffset += col.getSize();
      }
    }

    let rightOffset = 0;
    for (const col of [...allCols].reverse()) {
      if (col.columnDef.meta?.sticky === "right") {
        rightMap[col.id] = rightOffset;
        rightOffset += col.getSize();
      }
    }

    return { leftMap, rightMap };
  }, [table]);
}

/**
 * Returns helper functions for sticky column styling.
 */
function getStickyProps(
  stickyPositionMap: StickyPositionMap,
  colId: string,
  sticky: "left" | "right" | undefined,
  position: "head" | "cell",
  rowIdx?: number,
  rowLen?: number
) {
  const isLeft = sticky === "left";
  const isRight = sticky === "right";
  const left = isLeft ? stickyPositionMap.leftMap[colId] : undefined;
  const right = isRight ? stickyPositionMap.rightMap[colId] : undefined;

  const isLastStickyLeft =
    isLeft &&
    left === Math.max(...Object.values(stickyPositionMap.leftMap), -1);
  const isLastStickyRight =
    isRight &&
    right === Math.max(...Object.values(stickyPositionMap.rightMap), -1);

  const isTopLeft = isLeft && left === 0 && position === "head";
  const isTopRight = isRight && right === 0 && position === "head";
  const isBottomLeft =
    isLeft && left === 0 && position === "cell" && rowIdx === rowLen! - 1;
  const isBottomRight =
    isRight && right === 0 && position === "cell" && rowIdx === rowLen! - 1;

  return {
    style: { left, right } as React.CSSProperties,
    isSticky: isLeft || isRight,
    isTopLeft,
    isTopRight,
    isBottomLeft,
    isBottomRight,
    isLastStickyLeft,
    isLastStickyRight,
  };
}

export { useStickyColumns, getStickyProps };
