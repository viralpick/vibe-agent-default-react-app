import { describe, expect, it } from "vitest";
import { analyzeProject } from "./aos-locator";
import { AosProject } from "./aos-project";

// 가공 레시피 (AOS-6186) — 실제 생성 앱(2026-10-12 로컬, src/modules 다중 파일)의 모양을 줄인 것

const CONSTANTS = `
export const TENANT_ID = "1";
export const PAGE_SIZE = 20;
export const FUNCTIONS = {
  brand_summary: { id: "uuid-summary", description: "요약" },
  by_region: { id: "uuid-region", description: "지역별" },
  brand_list: { id: "uuid-list", description: "목록" },
};
`;

const UTILS = `
export const readToken = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name);
export const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
export const formatNumber = (value: unknown): string => toNumber(value).toLocaleString("ko-KR");
export const firstRow = (rows: any[]): Record<string, any> => (rows && rows.length > 0 ? rows[0] : {});
export const filterRows = (rows: any[], keyword: string, fields: string[]): any[] => {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => fields.some((field) => String(row?.[field] ?? "").toLowerCase().includes(needle)));
};
`;

const UI = `
import type { ReactNode } from "react";
export function Stat({ label, value }: { label: string; value: ReactNode }) { return <div>{label}{value}</div>; }
export function DataTable({ columns, rows }: { columns: any[]; rows: any[] }) { return <table>{rows.length}</table>; }
export function Card({ children, ...rest }: any) { return <div {...rest}>{children}</div>; }
`;

function manifestOf(files: Record<string, string>) {
  const project = AosProject.fromSources({
    "src/modules/constants.ts": CONSTANTS,
    "src/modules/utils.ts": UTILS,
    "src/modules/ui.tsx": UI,
    ...files,
  });
  return analyzeProject(project, { injectLoc: false }).manifest;
}

function vizOf(files: Record<string, string>, component: string) {
  return manifestOf(files).visualizations.filter((v) => v.component === component);
}

/** 레시피를 실제로 돌려 본다 — 홈 Worker 와 같은 호출 */
function run(source: string, inputs: Record<string, unknown[]>, lib: Record<string, Record<string, unknown>> = {}) {
  return new Function(`return (${source})`)()(inputs, lib);
}

const SUMMARY = `
import { useMemo } from "react";
import { Stat } from "@/modules/ui";
import { firstRow, formatNumber, toNumber } from "@/modules/utils";

export function SummaryMetrics({ brandRows, isLoading }: { brandRows: any[]; isLoading: boolean }) {
  const brand = useMemo(() => firstRow(brandRows), [brandRows]);
  const brandCount = toNumber(brand.brand_count);
  const premiumRatio = brandCount > 0 ? toNumber(brand.premium_count) / brandCount : 0;
  return (
    <section data-aos-id="summary">
      <Stat label="전체 브랜드" value={formatNumber(brandCount)} loading={isLoading} />
      <Stat label="프리미엄 비중" value={\`\${(premiumRatio * 100).toFixed(1)}%\`} />
    </section>
  );
}
`;

const APP = `
import { useOntologyFunction } from "@/hooks/useOntologyFunction";
import { FUNCTIONS, TENANT_ID } from "@/modules/constants";
import { SummaryMetrics } from "@/modules/SummaryMetrics";
export default function App() {
  const brandSummary = useOntologyFunction(FUNCTIONS.brand_summary, { tenantId: TENANT_ID });
  return <main><SummaryMetrics brandRows={brandSummary.data} isLoading={brandSummary.isLoading} /></main>;
}
`;

describe("가공 레시피 — 파일을 넘는 props 와 헬퍼", () => {
  it("다른 파일에서 props 로 받은 행을 헬퍼로 가공한 KPI 값을 레시피로 옮긴다", () => {
    const vizs = vizOf({ "src/App.tsx": APP, "src/modules/SummaryMetrics.tsx": SUMMARY }, "SummaryMetrics");

    expect(vizs.map((v) => [v.kind, v.library, v.element, v.reproducible])).toEqual([
      ["KPI", "custom", "Stat", true],
      ["KPI", "custom", "Stat", true],
    ]);
    expect(vizs[0].spec.props).toMatchObject({ label: "전체 브랜드" });
    expect(vizs[0].recipe).toMatchObject({ functions: ["uuid-summary"], libraries: [] });

    const inputs = { "uuid-summary": [{ brand_count: 1200, premium_count: 300 }] };
    expect(run(vizs[0].recipe!.source, inputs)).toBe("1,200");
    expect(run(vizs[1].recipe!.source, inputs)).toBe("25.0%");
  });

  it("헬퍼는 쓰는 것만 담는다 — document 를 쓰는 헬퍼가 같은 파일에 있어도 막지 않는다", () => {
    const [viz] = vizOf({ "src/App.tsx": APP, "src/modules/SummaryMetrics.tsx": SUMMARY }, "SummaryMetrics");

    expect(viz.recipe!.source).toContain("toNumber");
    expect(viz.recipe!.source).not.toContain("readToken");
    expect(viz.recipe!.source).not.toContain(": unknown"); // 타입은 지운다
  });

  it("컴포넌트를 쓰는 곳마다 다른 데이터를 넘기면 재현 불가", () => {
    const app = APP.replace(
      "</main>",
      "<SummaryMetrics brandRows={[]} isLoading={false} /></main>",
    );
    const [viz] = vizOf({ "src/App.tsx": app, "src/modules/SummaryMetrics.tsx": SUMMARY }, "SummaryMetrics");

    expect(viz.reproducible).toBe(false);
    expect(viz.reason).toContain("쓰는 곳마다");
  });
});

const TABLE = `
import { useMemo, useState } from "react";
import { useOntologyFunction } from "@/hooks/useOntologyFunction";
import { FUNCTIONS, PAGE_SIZE, TENANT_ID } from "@/modules/constants";
import { Badge, DataTable } from "@/modules/ui";
import { filterRows } from "@/modules/utils";

export function BrandTable() {
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [premiumOnly, setPremiumOnly] = useState<boolean>(false);
  const brands = useOntologyFunction(FUNCTIONS.brand_list, {
    tenantId: TENANT_ID,
    parameters: { offset: page * PAGE_SIZE, limit: PAGE_SIZE },
  });
  const rows = useMemo(() => {
    const searched = filterRows(brands.data, keyword, ["brand_name"]);
    return premiumOnly ? searched.filter((row: any) => row.is_premium) : searched;
  }, [brands.data, keyword, premiumOnly]);
  const columns: Column<any>[] = [
    { key: "brand_name", header: "브랜드명" },
    { key: "is_premium", header: "등급", render: (row) => (row.is_premium ? <Badge>프리미엄</Badge> : "일반") },
    { id: "actions", header: "", render: () => <button onClick={() => setPage(page + 1)}>다음</button> },
  ];
  return (
    <section data-aos-id="brand-table">
      <input value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      <DataTable columns={columns} rows={rows} />
    </section>
  );
}
`;

describe("가공 레시피 — 화면 상태와 파라미터", () => {
  it("useState 는 처음 값으로 굳히고, 함수 파라미터도 레시피로 싣는다", () => {
    const [viz] = vizOf({ "src/modules/BrandTable.tsx": TABLE }, "BrandTable");

    expect(viz).toMatchObject({ kind: "TABLE", library: "custom", element: "DataTable", reproducible: true });
    expect(viz.spec.props.columns).toEqual([
      { field: "brand_name", header: "브랜드명", custom: false },
      { field: "is_premium", header: "등급", custom: true },
    ]);
    const rows = [{ brand_name: "A", is_premium: true }, { brand_name: "B", is_premium: false }];
    // 검색어 "" · 프리미엄만 꺼짐 — 첫 화면 그대로 전부
    expect(run(viz.recipe!.source, { "uuid-list": rows })).toEqual(rows);
    expect(run(viz.parameters["uuid-list"], {})).toEqual({ offset: 0, limit: 20 });
  });

  it("TanStack ColumnDef 의 header 함수에서 제목을 읽는다", () => {
    const [viz] = vizOf(
      {
        "src/App.tsx": `
        import { DataTable, DataTableColumnHeader } from "@enhans/synapse/data-table";
        import { useOntologyFunction } from "@/hooks/useOntologyFunction";
        import { FUNCTIONS, TENANT_ID } from "@/modules/constants";
        const columns = [
          { accessorKey: "name", header: ({ column }: any) => <DataTableColumnHeader column={column} title="이름" /> },
          { accessorKey: "amount", header: "금액", cell: ({ row }: any) => row.getValue("amount") },
        ];
        export default function App() {
          const list = useOntologyFunction(FUNCTIONS.brand_list, { tenantId: TENANT_ID, parameters: { offset: 0, limit: 20 } });
          return <div data-aos-id="t"><DataTable data={list.data} columns={columns}><DataTable.Body /></DataTable></div>;
        }`,
      },
      "App",
    );

    expect(viz).toMatchObject({ kind: "TABLE", library: "synapse", reproducible: true, recipe: null });
    expect(viz.spec.props.columns).toEqual([
      { field: "name", header: "이름", custom: false },
      { field: "amount", header: "금액", custom: true },
    ]);
    expect(run(viz.parameters["uuid-list"], {})).toEqual({ offset: 0, limit: 20 });
  });
});

const chartFile = (body: string, imports = "") => `
import { useMemo } from "react";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { useOntologyFunction } from "@/hooks/useOntologyFunction";
import { FUNCTIONS, TENANT_ID } from "@/modules/constants";
import { toNumber } from "@/modules/utils";
${imports}
export function RegionChart() {
  const regions = useOntologyFunction(FUNCTIONS.by_region, { tenantId: TENANT_ID });
  ${body}
}
`;

describe("가공 레시피 — 차트", () => {
  it("정렬 · 자르기와 가로 막대(YAxis 범주)를 옮긴다", () => {
    const [viz] = vizOf(
      {
        "src/modules/RegionChart.tsx": chartFile(`
          const rows = useMemo(
            () => [...regions.data].sort((a: any, b: any) => toNumber(b?.score) - toNumber(a?.score)).slice(0, 2),
            [regions.data],
          );
          return <div data-aos-id="r"><BarChart data={rows} layout="vertical"><XAxis type="number" /><YAxis type="category" dataKey="region" /><Bar dataKey="score" /></BarChart></div>;`),
      },
      "RegionChart",
    );

    expect(viz).toMatchObject({ kind: "BAR", reproducible: true, spec: { props: { xField: "region", yField: "score" } } });
    expect(run(viz.recipe!.source, { "uuid-region": [{ region: "a", score: 1 }, { region: "b", score: 3 }, { region: "c", score: "2" }] })).toEqual([
      { region: "b", score: 3 },
      { region: "c", score: "2" },
    ]);
  });

  it("허용한 라이브러리(date-fns)는 __lib 로 받는다", () => {
    const [viz] = vizOf(
      {
        "src/modules/RegionChart.tsx": chartFile(
          `const rows = useMemo(() => regions.data.map((r: any) => ({ day: format(parseISO(r.date), "MM/dd"), v: r.v })), [regions.data]);
           return <div data-aos-id="r"><BarChart data={rows}><XAxis dataKey="day" /><Bar dataKey="v" /></BarChart></div>;`,
          `import { format, parseISO } from "date-fns";`,
        ),
      },
      "RegionChart",
    );

    expect(viz.recipe!.libraries).toEqual(["date-fns"]);
    const lib = { "date-fns": { parseISO: (s: string) => s, format: (s: string) => `F(${s})` } };
    expect(run(viz.recipe!.source, { "uuid-region": [{ date: "2026-10-12", v: 1 }] }, lib)).toEqual([{ day: "F(2026-10-12)", v: 1 }]);
  });

  const rejected = (body: string, imports = "") =>
    vizOf({ "src/modules/RegionChart.tsx": chartFile(body, imports) }, "RegionChart")[0];

  it.each([
    ["window 를 쓰는 가공", `const rows = useMemo(() => regions.data.slice(0, window.innerWidth > 800 ? 10 : 5), [regions.data]);`, "window"],
    ["허용 목록 밖 import", `const rows = useMemo(() => groupBy(regions.data), [regions.data]);`, "lodash", `import { groupBy } from "lodash";`],
    ["다른 React hook 값", `const ref = useRef(5); const rows = useMemo(() => regions.data.slice(0, ref.current), [regions.data]);`, "useRef", `import { useRef } from "react";`],
    ["잘라 낸 코드 밖에서 바꾸는 값", `const rows = regions.data.slice(0, 5); rows.reverse();`, "바꿈"],
    ["constructor 접근", `const rows = useMemo(() => regions.data.slice(0, [].constructor.length), [regions.data]);`, "constructor"],
  ])("%s 는 재현 불가로 둔다", (_name, body, reason, imports = "") => {
    const viz = rejected(`${body}\n return <div data-aos-id="r"><BarChart data={rows}><XAxis dataKey="x" /><Bar dataKey="y" /></BarChart></div>;`, imports);

    expect(viz.reproducible).toBe(false);
    expect(viz.recipe).toBeNull();
    expect(viz.reason).toContain(reason);
  });

  it("반복 안에서만 의미가 있는 값은 재현 불가", () => {
    const viz = rejected(
      `return <div data-aos-id="r">{[1, 2].map((n) => <BarChart key={n} data={regions.data.slice(0, n)}><XAxis dataKey="x" /><Bar dataKey="y" /></BarChart>)}</div>;`,
    );

    expect(viz.reproducible).toBe(false);
    expect(viz.reason).toContain("n");
  });
});
