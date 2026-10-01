import { describe, expect, it } from "vitest";
import { analyzeAosSource } from "./aos-locator";

const FILE = "src/App.tsx";
const HEAD = `
import { useMemo } from "react";
import { BarChart, KpiCard } from "@enhans/synapse/charts";
import { LineChart, Line, XAxis, YAxis, PieChart, Pie } from "recharts";
import { useOntologyFunction } from "@/hooks/useOntologyFunction";
const FUNCTIONS = { by_country: { id: "uuid-country" }, monthly: { id: "uuid-monthly" } };
const TENANT_ID = "1";
`;

function vizOf(body: string, id: string) {
  const result = analyzeAosSource(HEAD + body, FILE, { injectLoc: false });
  return result.components.find((c) => c.id === id)!.visualizations;
}

describe("visualizations — synapse", () => {
  const APP = `
    function CountryChart({ rows, colors }) {
      return (
        <section data-aos-id="country-chart">
          <BarChart key={JSON.stringify(rows)} data={rows} xField="country" yField={["brand_count", "premium_count"]}
            stacked direction="vertical" colors={colors} onBarClick={(e) => console.log(e)} />
        </section>
      );
    }
    function TrendChart({ rows }) {
      const chartData = useMemo(() => rows.map((r) => ({ m: r.month, v: r.count })), [rows]);
      return <section data-aos-id="trend"><BarChart data={chartData} xField="m" yField="v" /></section>;
    }
    export default function App() {
      const country = useOntologyFunction(FUNCTIONS.by_country, { tenantId: TENANT_ID });
      const monthly = useOntologyFunction(FUNCTIONS.monthly, { tenantId: TENANT_ID });
      return <main><CountryChart rows={country.data} colors={["#000"]} /><TrendChart rows={monthly.data} /></main>;
    }
  `;

  it("hook 결과를 그대로 받는 차트는 정적 props 를 명세로 담고 재현 가능으로 판정한다", () => {
    const [viz] = vizOf(APP, "country-chart");

    expect(viz).toMatchObject({
      library: "synapse",
      element: "BarChart",
      kind: "BAR",
      spec: {
        component: "BarChart",
        props: { xField: "country", yField: ["brand_count", "premium_count"], stacked: true, direction: "vertical" },
      },
      data: { functions: ["uuid-country"], direct: true },
      reproducible: true,
      reason: null,
    });
    // 함수 prop 은 버리고, 표현용 동적 prop(colors/key)은 재현을 막지 않는다
    expect(viz.spec.props).not.toHaveProperty("onBarClick");
    expect(viz.dynamicProps.sort()).toEqual(["colors", "key"]);
  });

  it("useMemo 로 변환한 data 는 재현 불가로 보고 이유를 남긴다", () => {
    const [viz] = vizOf(APP, "trend");

    expect(viz).toMatchObject({ data: { functions: ["uuid-monthly"], direct: false }, reproducible: false });
    expect(viz.reason).toContain("변환");
  });
});

describe("visualizations — recharts 정규화", () => {
  it("XAxis / Line 의 dataKey 를 xField / yField 로 옮긴다", () => {
    const [viz] = vizOf(
      `
      function Trend({ rows }) {
        return (
          <div data-aos-id="trend">
            <LineChart data={rows}><XAxis dataKey="month" /><YAxis /><Line type="monotone" dataKey="count" /></LineChart>
          </div>
        );
      }
      export default function App() {
        const monthly = useOntologyFunction(FUNCTIONS.monthly, { tenantId: TENANT_ID });
        return <Trend rows={monthly.data} />;
      }
    `,
      "trend",
    );

    expect(viz).toMatchObject({
      library: "recharts",
      kind: "LINE",
      spec: { component: "LineChart", props: { xField: "month", yField: "count", smooth: true } },
      reproducible: true,
    });
  });

  it("Pie 의 dataKey / nameKey 를 valueField / nameField 로 옮긴다", () => {
    const [viz] = vizOf(
      `
      function Share({ rows }) {
        return <div data-aos-id="share"><PieChart><Pie data={rows} dataKey="count" nameKey="country" innerRadius={40} /></PieChart></div>;
      }
      export default function App() {
        const country = useOntologyFunction(FUNCTIONS.by_country, { tenantId: TENANT_ID });
        return <Share rows={country.data} />;
      }
    `,
      "share",
    );

    expect(viz).toMatchObject({ kind: "PIE", spec: { props: { valueField: "count", nameField: "country", donut: true } } });
  });
});

describe("visualizations — 재현 불가 판정", () => {
  it("KPI 카드와 함수 여러 개를 섞은 data 는 재현 불가", () => {
    const vizs = vizOf(
      `
      function Summary({ total, rows }) {
        return (
          <section data-aos-id="summary">
            <KpiCard title="총합" value={total} />
            <BarChart data={rows} xField="x" yField="y" />
          </section>
        );
      }
      export default function App() {
        const country = useOntologyFunction(FUNCTIONS.by_country, { tenantId: TENANT_ID });
        const monthly = useOntologyFunction(FUNCTIONS.monthly, { tenantId: TENANT_ID });
        const rows = [...country.data, ...monthly.data];
        return <Summary total={country.data.length} rows={rows} />;
      }
    `,
      "summary",
    );

    expect(vizs.map((v) => [v.kind, v.reproducible])).toEqual([
      ["KPI", false],
      ["BAR", false],
    ]);
    expect(vizs[1].reason).toContain("여러 개");
  });

  it("import 출처가 차트 라이브러리가 아니면 시각화로 보지 않는다", () => {
    expect(
      vizOf(`function C() { return <div data-aos-id="c"><BarChart data={[]} /></div>; }`.replace("BarChart", "MyBar"), "c"),
    ).toEqual([]);
  });
});
