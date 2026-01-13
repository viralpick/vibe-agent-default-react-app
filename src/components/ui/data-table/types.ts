import type { Row } from "@tanstack/react-table";

export const filterOperators = [
  { value: "includes", label: "includes" },
  { value: "is", label: "is" },
  { value: "isNot", label: "is not" },
  { value: "startsWith", label: "starts with" },
  { value: "endsWith", label: "ends with" },
  { value: "isEmpty", label: "is empty" },
  { value: "isNotEmpty", label: "is not empty" },
] as const;

export type FilterOperator = (typeof filterOperators)[number]["value"];

export interface FilterValue {
  operator: FilterOperator;
  value: string;
}

export const textFilterFn = <TData = unknown>(
  row: Row<TData>,
  columnId: string,
  filterValue: FilterValue
): boolean => {
  const value = String(row.getValue(columnId) ?? "").toLowerCase();

  if (!filterValue.operator) {
    // Default to includes if no operator is provided
    return value.includes(String(filterValue ?? "").toLowerCase());
  }

  const filterText = String(filterValue.value ?? "").toLowerCase();

  switch (filterValue.operator) {
    case "is":
      return value === filterText;
    case "isNot":
      return value !== filterText;
    case "includes":
      return value.includes(filterText);
    case "startsWith":
      return value.startsWith(filterText);
    case "endsWith":
      return value.endsWith(filterText);
    case "isEmpty":
      return value === "";
    case "isNotEmpty":
      return value !== "";
    default:
      return true;
  }
};
