import { describe, expect, it } from "vitest";
import { analyzeAosSource, buildManifest } from "./aos-locator";

// 가공 레시피 (AOS-6186) — 실제 생성 앱(2026-10-12 로컬)의 모양을 `src/App.tsx` 한 파일로 줄인 것

const FILE = "src/App.tsx";

const HEAD = `
import { useMemo, useState } from "react";
import { useOntologyFunction } from "@/hooks/useOntologyFunction";
import type { ReactNode } from "react";

const TENANT_ID = "1";
const PAGE_SIZE = 20;
const FUNCTIONS = {
  brand_summary: { id: "uuid-summary", description: "요약" },
  by_region: { id: "uuid-region", description: "지역별" },
  brand_list: { id: "uuid-list", description: "목록" },
};

const readToken = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name);
const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const formatNumber = (value: unknown): string => toNumber(value).toLocaleString("ko-KR");
const firstRow = (rows: any[]): Record<string, any> => (rows && rows.length > 0 ? rows[0] : {});
function filterRows(rows: any[], keyword: string, fields: string[]): any[] {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => fields.some((field) => String(row?.[field] ?? "").toLowerCase().includes(needle)));
}

function Stat({ label, value }: { label: string; value: ReactNode }) { return <div>{label}{value}</div>; }
function DataTable({ columns, rows }: { columns: any[]; rows: any[] }) { return <table>{rows.length}</table>; }
function Card({ children, ...rest }: any) { return <div {...rest}>{children}</div>; }
`;

function vizOf(body: string, component: string) {
  const result = analyzeAosSource(HEAD + body, FILE, { injectLoc: false });
  const manifest = buildManifest(result.components, [result.file], result.visualizations, result.usages);
  return manifest.visualizations.filter((v) => v.component === component);
}

/** 레시피를 실제로 돌려 본다 — 홈 Worker 와 같은 호출 */
function run(source: string, inputs: Record<string, unknown[]>, lib: Record<string, Record<string, unknown>> = {}) {
  return new Function(`return (${source})`)()(inputs, lib);
}

const SUMMARY = `
function SummaryMetrics({ brandRows, isLoading }: { brandRows: any[]; isLoading: boolean }) {
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

const APP = (extra = "") => `
export default function App() {
  const brandSummary = useOntologyFunction(FUNCTIONS.brand_summary, { tenantId: TENANT_ID });
  return <main><SummaryMetrics brandRows={brandSummary.data} isLoading={brandSummary.isLoading} />${extra}</main>;
}
`;

describe("가공 레시피 — props 와 헬퍼", () => {
  it("props 로 받은 행을 헬퍼로 가공한 KPI 값을 레시피로 옮긴다", () => {
    const vizs = vizOf(SUMMARY + APP(), "SummaryMetrics");

    expect(vizs.map((v) => [v.kind, v.library, v.element, v.reproducible])).toEqual([
      ["KPI", "custom", "Stat", true],
      ["KPI", "custom", "Stat", true],
    ]);
    expect(vizs[0].spec.props).toMatchObject({ label: "전체 브랜드" });
    expect(vizs.map((v) => v.title)).toEqual(["전체 브랜드", "프리미엄 비중"]);
    expect(vizs[0].recipe).toMatchObject({ functions: ["uuid-summary"], libraries: [] });

    const inputs = { "uuid-summary": [{ brand_count: 1200, premium_count: 300 }] };
    expect(run(vizs[0].recipe!.source, inputs)).toBe("1,200");
    expect(run(vizs[1].recipe!.source, inputs)).toBe("25.0%");
  });

  it("헬퍼는 쓰는 것만 담는다 — document 를 쓰는 헬퍼가 같은 파일에 있어도 막지 않는다", () => {
    const [viz] = vizOf(SUMMARY + APP(), "SummaryMetrics");

    expect(viz.recipe!.source).toContain("toNumber");
    expect(viz.recipe!.source).not.toContain("readToken");
    expect(viz.recipe!.source).not.toContain(": unknown"); // 타입은 지운다
  });

  it("컴포넌트를 쓰는 곳마다 다른 데이터를 넘기면 재현 불가", () => {
    const [viz] = vizOf(SUMMARY + APP("<SummaryMetrics brandRows={[]} isLoading={false} />"), "SummaryMetrics");

    expect(viz.reproducible).toBe(false);
    expect(viz.reason).toContain("쓰는 곳마다");
  });
});

const TABLE = `
function BrandTable() {
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
    { key: "is_premium", header: "등급", render: (row) => (row.is_premium ? <b>프리미엄</b> : "일반") },
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
    const [viz] = vizOf(TABLE, "BrandTable");

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
      `
      import { DataTable as SynapseTable, DataTableColumnHeader } from "@enhans/synapse/data-table";
      const columns = [
        { accessorKey: "name", header: ({ column }: any) => <DataTableColumnHeader column={column} title="이름" /> },
        { accessorKey: "amount", header: "금액", cell: ({ row }: any) => row.getValue("amount") },
      ];
      export default function App() {
        const list = useOntologyFunction(FUNCTIONS.brand_list, { tenantId: TENANT_ID, parameters: { offset: 0, limit: 20 } });
        return <div data-aos-id="t"><SynapseTable data={list.data} columns={columns}><SynapseTable.Body /></SynapseTable></div>;
      }`,
      "App",
    ).filter((v) => v.kind === "TABLE");

    expect(viz).toMatchObject({ kind: "TABLE", library: "synapse", element: "DataTable", reproducible: true, recipe: null });
    expect(viz.spec.props.columns).toEqual([
      { field: "name", header: "이름", custom: false },
      { field: "amount", header: "금액", custom: true },
    ]);
    expect(run(viz.parameters["uuid-list"], {})).toEqual({ offset: 0, limit: 20 });
  });
});

const chartFile = (body: string, imports = "") => `
import { Bar, BarChart, XAxis, YAxis } from "recharts";
${imports}
function RegionChart() {
  const regions = useOntologyFunction(FUNCTIONS.by_region, { tenantId: TENANT_ID });
  ${body}
}
`;

describe("가공 레시피 — 차트", () => {
  it("정렬 · 자르기와 가로 막대(YAxis 범주)를 옮기고, 감싼 카드 제목을 이름으로 싣는다", () => {
    const [viz] = vizOf(
      chartFile(`
        const rows = useMemo(
          () => [...regions.data].sort((a: any, b: any) => toNumber(b?.score) - toNumber(a?.score)).slice(0, 2),
          [regions.data],
        );
        return <Card title="지역별 점수" data-aos-id="r"><BarChart data={rows} layout="vertical"><XAxis type="number" /><YAxis type="category" dataKey="region" /><Bar dataKey="score" /></BarChart></Card>;`),
      "RegionChart",
    );

    expect(viz).toMatchObject({ kind: "BAR", reproducible: true, title: "지역별 점수", spec: { props: { xField: "region", yField: "score" } } });
    expect(run(viz.recipe!.source, { "uuid-region": [{ region: "a", score: 1 }, { region: "b", score: 3 }, { region: "c", score: "2" }] })).toEqual([
      { region: "b", score: 3 },
      { region: "c", score: "2" },
    ]);
  });

  it("허용한 라이브러리(date-fns)는 __lib 로 받는다", () => {
    const [viz] = vizOf(
      chartFile(
        `const rows = useMemo(() => regions.data.map((r: any) => ({ day: format(parseISO(r.date), "MM/dd"), v: r.v })), [regions.data]);
         return <div data-aos-id="r"><BarChart data={rows}><XAxis dataKey="day" /><Bar dataKey="v" /></BarChart></div>;`,
        `import { format, parseISO } from "date-fns";`,
      ),
      "RegionChart",
    );

    expect(viz.recipe!.libraries).toEqual(["date-fns"]);
    const lib = { "date-fns": { parseISO: (s: string) => s, format: (s: string) => `F(${s})` } };
    expect(run(viz.recipe!.source, { "uuid-region": [{ date: "2026-10-12", v: 1 }] }, lib)).toEqual([{ day: "F(2026-10-12)", v: 1 }]);
  });

  const rejected = (body: string, imports = "") => vizOf(chartFile(body, imports), "RegionChart")[0];

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
