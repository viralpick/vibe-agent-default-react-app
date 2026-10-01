import { parse } from "@babel/parser";
import { describe, expect, it } from "vitest";
import type { Node } from "./aos-ast";
import { analyzeDataflow } from "./aos-dataflow";

const FILE = "src/App.tsx";

const HEADER = `
const FUNCTIONS = {
  monthly_registration: { id: "uuid-monthly", description: "월별 등록" },
  brand_list: { id: "uuid-brand", description: "브랜드 목록" },
};
const TENANT_ID = "1";
`;

function analyze(body: string) {
  const ast = parse(HEADER + body, { sourceType: "module", plugins: ["typescript", "jsx"] }) as unknown as Node;
  return analyzeDataflow(ast, FILE);
}

function keysOf(result: ReturnType<typeof analyze>, name: string) {
  return result.components.find((c) => c.name === name)?.functionKeys;
}

describe("analyzeDataflow — 추적", () => {
  // 실제 생성 앱(2026-09-30 로컬 E2E)의 구조를 hook 패턴으로 옮긴 것
  const DASHBOARD = `
    function KpiGrid({ metrics, isLoading }: { metrics: Metrics; isLoading: boolean }) {
      return <section data-aos-id="kpi-grid">{metrics.total}</section>;
    }
    function TrendChart({ rows }) {
      const chartData = useMemo(() => rows.map((r) => ({ x: r.month, y: r.count })), [rows]);
      return <section data-aos-id="trend"><LineChart data={chartData} /></section>;
    }
    function BrandTable(props) {
      return (
        <section data-aos-id="brand-table">
          {props.rows.map((row) => <BrandRow key={row.id} row={row} />)}
        </section>
      );
    }
    function BrandRow({ row }) { return <tr><td>{row.name}</td></tr>; }
    function Header({ title }) { return <header data-aos-id="header">{title}</header>; }

    export default function App() {
      const monthly = useOntologyFunction(FUNCTIONS.monthly_registration, { tenantId: TENANT_ID });
      const { data: brandRows, isLoading } = useOntologyFunction(FUNCTIONS.brand_list, { tenantId: TENANT_ID });
      const filtered = useMemo(() => brandRows.filter((b) => b.active), [brandRows]);
      const metrics = useMemo(() => ({ total: filtered.length, months: monthly.data.length }), [filtered, monthly.data]);
      const loading = isLoading || monthly.isLoading;
      return (
        <div>
          <Header title="브랜드" />
          <KpiGrid metrics={metrics} isLoading={loading} />
          <TrendChart rows={monthly.data} />
          <BrandTable rows={filtered} />
        </div>
      );
    }
  `;

  it("hook → useMemo → props 를 따라 컴포넌트별 함수를 계산한다", () => {
    const result = analyze(DASHBOARD);

    expect(keysOf(result, "KpiGrid")).toEqual(["brand_list", "monthly_registration"]);
    expect(keysOf(result, "TrendChart")).toEqual(["monthly_registration"]);
    expect(keysOf(result, "BrandTable")).toEqual(["brand_list"]);
    expect(result.functionIds.get("brand_list")).toBe("uuid-brand");
    expect(result.usesHook).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("공유 로딩 플래그는 함수를 운반하지 않는다", () => {
    const result = analyze(DASHBOARD);

    expect(keysOf(result, "Header")).toEqual([]);
    const kpi = result.components.find((c) => c.name === "KpiGrid")!;
    expect(kpi.bindings.map((b) => b.prop)).not.toContain("isLoading");
  });

  it("map 콜백 파라미터와 2단계 prop 전달을 따라간다", () => {
    expect(keysOf(analyze(DASHBOARD), "BrandRow")).toEqual(["brand_list"]);
  });

  it("차트 data 가 hook 결과 그대로인지(direct) 변환을 거쳤는지 구분한다", () => {
    const result = analyze(DASHBOARD);
    const app = result.components.find((c) => c.name === "App")!;
    const trend = result.components.find((c) => c.name === "TrendChart")!;

    expect(app.bindings.find((b) => b.element === "TrendChart")).toMatchObject({ prop: "rows", direct: true });
    expect(app.bindings.find((b) => b.element === "BrandTable")).toMatchObject({ direct: false });
    expect(trend.bindings.find((b) => b.element === "LineChart")).toMatchObject({
      prop: "data",
      functionKeys: ["monthly_registration"],
      direct: false,
    });
  });

  it("컴포넌트 안에서 직접 hook 을 부르면 그 컴포넌트에 붙는다", () => {
    const result = analyze(`
      const BrandCard = memo(function BrandCard() {
        const brands = useOntologyFunction(FUNCTIONS.brand_list, { tenantId: TENANT_ID });
        return <div data-aos-id="brand-card">{brands.data.length}</div>;
      });
    `);

    expect(keysOf(result, "BrandCard")).toEqual(["brand_list"]);
  });

  it("선언 순서와 무관하게 수렴한다", () => {
    const result = analyze(`
      function Child({ v }) { return <div>{v}</div>; }
      function App() {
        const late = useMemo(() => early, [early]);
        const early = brands.data;
        const brands = useOntologyFunction(FUNCTIONS.brand_list, { tenantId: TENANT_ID });
        return <Child v={late} />;
      }
    `);

    expect(keysOf(result, "Child")).toEqual(["brand_list"]);
  });
});

describe("analyzeDataflow — 위반", () => {
  it("기존 Promise.all + 직접 호출 패턴을 위반으로 보고한다", () => {
    const result = analyze(`
      export default function App() {
        const fetchData = useCallback(async () => {
          const [a, b] = await Promise.all([
            apiClient.post(\`/ontology-functions/\${FUNCTIONS.monthly_registration.id}/run\`, {}),
            apiClient.post(\`/ontology-functions/\${FUNCTIONS.brand_list.id}/run\`, {}),
          ]);
        }, []);
        return <div />;
      }
    `);

    const rules = result.violations.map((v) => v.rule);
    expect(rules.filter((r) => r === "functions-outside-hook")).toHaveLength(2);
    expect(rules.filter((r) => r === "direct-run-call")).toHaveLength(2);
    expect(result.usesHook).toBe(false);
  });

  it("hook 첫 인자가 FUNCTIONS.<key> 가 아니거나 없는 key 면 보고한다", () => {
    const result = analyze(`
      function App() {
        const a = useOntologyFunction({ id: "forged-uuid" }, { tenantId: TENANT_ID });
        const b = useOntologyFunction(FUNCTIONS.missing, { tenantId: TENANT_ID });
        const c = useOntologyFunction(FUNCTIONS[name], { tenantId: TENANT_ID });
        doSomething(FUNCTIONS);
        return <div />;
      }
    `);

    const rules = result.violations.map((v) => v.rule).sort();
    expect(rules).toEqual(["functions-dynamic-key", "functions-escape", "hook-arg-not-functions", "hook-arg-not-functions", "unknown-function-key"]);
    expect(result.violations.every((v) => /^src\/App\.tsx:\d+:\d+$/.test(v.loc))).toBe(true);
  });
});
