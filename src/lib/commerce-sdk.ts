import type { AxiosInstance } from "axios";
import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const customTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            (value: string) =>
              value.startsWith("label-") ||
              value.startsWith("caption-") ||
              value.startsWith("syntax-") ||
              value.startsWith("body-"),
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return customTwMerge(clsx(inputs));
}

export const Format = {
  currency: (value: number | undefined | null) =>
    `₩${(value ?? 0).toLocaleString("ko-KR")}`,

  number: (value: number | undefined | null) =>
    (value ?? 0).toLocaleString("ko-KR"),

  percent: (value: number | undefined | null) => `${(value ?? 0).toFixed(2)}%`,

  date: (value: string | undefined | null) =>
    value ? new Date(value).toLocaleDateString("ko-KR") : "-",

  default: (value: unknown, fallback = "-") =>
    value === null || value === undefined || value === "" ? fallback : value,

  axisNumber: (value: number | undefined | null) => {
    const num = value ?? 0;
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toString();
  },
};

export const QueryBuilder = {
  aggregation: (
    collection: string,
    args: {
      groupBy: string[];
      sum?: string[];
      avg?: string[];
      min?: string[];
      max?: string[];
      filters?: Array<{ field: string; operator: string; value: string }>;
    }
  ) => {
    const filterStr =
      args.filters
        ?.map(
          (f) =>
            `{ field: "${f.field}", operator: ${f.operator}, value: "${f.value}" }`
        )
        .join(", ") || "";

    const sumFields = args.sum ? `sum: ${JSON.stringify(args.sum)}` : "";
    const avgFields = args.avg ? `avg: ${JSON.stringify(args.avg)}` : "";

    const responseFields = `
      groupBy
      count
      ${args.sum ? "sum" : ""}
      ${args.avg ? "avg" : ""}
      ${args.min ? "min" : ""}
      ${args.max ? "max" : ""}
    `;

    return `query Source {
      source {
        ${collection}_aggregation(
          groupBy: ${JSON.stringify(args.groupBy)},
          ${sumFields},
          ${avgFields},
          filters: [${filterStr}]
        ) {
          ${responseFields}
        }
      }
    }`;
  },

  list: (
    collection: string,
    args: {
      page?: number;
      limit?: number;
      filters?: Array<{ field: string; operator: string; value: string }>;
    } = {}
  ) => {
    const filterStr =
      args.filters
        ?.map(
          (f) =>
            `{ field: "${f.field}", operator: ${f.operator}, value: "${f.value}" }`
        )
        .join(", ") || "";

    const page = args.page || 1;
    const limit = args.limit || 20;

    return `query Source {
      source {
        ${collection}(
          limit: ${limit}, 
          page: ${page}, 
          filters: [${filterStr}]
        ) {
          totalPageCount
          page
          rows
        }
      }
    }`;
  },
};

export async function fetchSmartDateRange(
  apiClient: AxiosInstance,
  collection: string,
  dateField: string
) {
  const sampleQuery = QueryBuilder.list(collection, { limit: 50 });
  const res = await apiClient.post(
    "https://app-api-v2-dev.commerceos.ai/sources/graphql",
    {
      query: sampleQuery,
      variables: {},
    }
  );

  const rows = res?.data?.data?.source?.[collection]?.rows || [];
  if (rows.length === 0) return null;

  const dates = rows
    .map((r: Record<string, unknown>) => r[dateField])
    .filter((d: unknown) => d)
    .map((d: unknown) => new Date(d as string).getTime());

  if (dates.length === 0) return null;

  const maxDate = new Date(Math.max(...dates));

  const endDate = new Date(maxDate);
  const startDate = new Date(maxDate);
  startDate.setDate(startDate.getDate() - 6);

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
}

export function getColorClass(
  color: string | undefined,
  fallback = "primary",
  prefix = "bg"
): string {
  if (!color) return `${prefix}-${fallback}`;

  const isArbitrary = /^(#|rgb|rgba|hsl|hsla|var\()/.test(color);
  return isArbitrary ? `${prefix}-[${color}]` : `${prefix}-${color}`;
}

export function parseArrayString(value: string): string[] | null {
  try {
    const trimmed = value.trim();

    if (trimmed === "[]") return [];
    const match = trimmed.match(/^\[(.*)\]$/);
    if (!match) return null;

    const content = match[1];
    const items = content
      .split(",")
      .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);

    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}
