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

describe("analyzeDataflow — bindings", () => {
  it("host 엘리먼트 속성과 key 는 바인딩으로 기록하지 않는다", () => {
    const result = analyze(`
      function Table({ rows }) {
        return (
          <section data-aos-id="t">
            {rows.map((r) => <tr key={r.id} className={r.cls}><Cell value={r.v} /></tr>)}
            <button disabled={rows.length === 0} />
          </section>
        );
      }
      function App() {
        const brands = useOntologyFunction(FUNCTIONS.brand_list, { tenantId: TENANT_ID });
        return <Table rows={brands.data} />;
      }
    `);
    const table = result.components.find((c) => c.name === "Table")!;

    expect(table.bindings.map((b) => `${b.element}.${b.prop}`)).toEqual(["Cell.value"]);
  });
});

describe("analyzeDataflow — 값을 바꾸지 않는 감싸기 (AOS-4929)", () => {
  function chartDirect(transform: string) {
    const result = analyze(`
      function Chart({ rows }) { return <section data-aos-id="c"><BarChart data={rows} /></section>; }
      function App() {
        const brands = useOntologyFunction(FUNCTIONS.brand_list, { tenantId: TENANT_ID });
        const rows = ${transform};
        return <Chart rows={rows} />;
      }
    `);
    return result.components.find((c) => c.name === "Chart")!.bindings.find((b) => b.element === "BarChart")!.direct;
  }

  it.each([
    "useMemo(() => brands.data, [brands.data])",
    'useMemo(() => brands.data.filter((row) => row && typeof row === "object"), [brands.data])',
    "brands.data.filter(Boolean)",
    "brands.data.filter((r) => r != null)",
    "useMemo(() => { return brands.data.filter((r) => Boolean(r)); }, [brands.data])",
  ])("null 방어·useMemo 감싸기는 direct 로 본다: %s", (transform) => {
    expect(chartDirect(transform)).toBe(true);
  });

  it.each([
    "brands.data.slice(-50)",
    "brands.data.filter((r) => r.active)",
    "brands.data.map((r) => ({ x: r.country }))",
    'useMemo(() => brands.data.filter((row) => row && typeof row === "object").slice(-50), [brands.data])',
  ])("행을 바꾸는 가공은 derived 로 본다: %s", (transform) => {
    expect(chartDirect(transform)).toBe(false);
  });
});

describe("analyzeDataflow — 액션 추적 (AOS-7001)", () => {
  const ACTION_HEADER = `
const FUNCTIONS = { save: { id: "uuid-fn-save" }, orders: { id: "uuid-orders" } };
const ACTIONS = {
  approve: { id: "uuid-approve", description: "승인" },
  save: { id: "uuid-act-save" },
};
const TENANT_ID = "1";
`;

  function analyzeActions(body: string, file = FILE) {
    const ast = parse(ACTION_HEADER + body, { sourceType: "module", plugins: ["typescript", "jsx"] }) as unknown as Node;
    return analyzeDataflow(ast, file);
  }

  const componentOf = (result: ReturnType<typeof analyze>, name: string) => result.components.find((c) => c.name === name)!;

  it("컴포넌트 안에서 직접 execute 를 부르면 그 컴포넌트가 액션을 쓴다", () => {
    const result = analyzeActions(`
      function App() {
        const approve = useOntologyAction(ACTIONS.approve, { tenantId: TENANT_ID });
        return <button onClick={() => approve.execute()}>승인</button>;
      }
    `);

    expect(componentOf(result, "App")).toMatchObject({ actionKeys: ["approve"], actionIds: ["uuid-approve"], functionKeys: [] });
    expect(result.actionIds.get("approve")).toBe("uuid-approve");
    expect(result.usesActionHook).toBe(true);
    expect(result.usesHook).toBe(false);
    expect(result.actionViolations).toEqual([]);
    expect(result.violations).toEqual([]);
  });

  it("execute 를 prop 으로 받은 자식은 액션을 쓰고, 실행 중 표시만 받은 자식은 쓰지 않는다", () => {
    const result = analyzeActions(`
      function Row({ onApprove }) { return <button onClick={() => onApprove()} />; }
      function SaveBar({ onSave }) { return <button onClick={onSave} />; }
      function Spinner({ busy, state, last }) { return <span>{busy ? "..." : state}{String(last)}</span>; }
      function App() {
        const approve = useOntologyAction(ACTIONS.approve, { tenantId: TENANT_ID });
        const { execute: runSave, isRunning, data } = useOntologyAction(ACTIONS.save, { tenantId: TENANT_ID });
        const save = useCallback(() => runSave({ x: 1 }), [runSave]);
        return (
          <main>
            <Row onApprove={approve.execute} />
            <SaveBar onSave={save} />
            <Spinner busy={approve.isRunning || isRunning} state={approve.status} last={data ?? approve.error} />
          </main>
        );
      }
    `);

    expect(componentOf(result, "Row").actionKeys).toEqual(["approve"]);
    expect(componentOf(result, "SaveBar").actionIds).toEqual(["uuid-act-save"]);
    expect(componentOf(result, "Spinner").actionKeys).toEqual([]);
    expect(componentOf(result, "App").actionKeys).toEqual(["approve", "save"]);
    expect(componentOf(result, "App").bindings).toEqual([]);
  });

  it("결과를 별칭·구조 분해·prop 으로 넘겨도 실행 중 표시는 액션을 운반하지 않는다", () => {
    const result = analyzeActions(`
      function Spinner({ busy }) { return <span>{busy ? "..." : ""}</span>; }
      function Label({ text }) { return <span>{text}</span>; }
      function Status({ action }) { return <span>{action.status}{String(action.isRunning)}</span>; }
      function Runner({ action }) {
        useEffect(() => { action.execute(); }, [action]);
        return <span>{action.status}</span>;
      }
      function Forward(props) { return <button onClick={() => props.action.execute()} />; }
      function Picked({ action }) {
        const { execute, isRunning } = action;
        return <button disabled={isRunning} onClick={() => execute()} />;
      }
      function SaveBar({ onSave }) { return <button onClick={onSave} />; }
      function App() {
        const approve = useOntologyAction(ACTIONS.approve, { tenantId: TENANT_ID });
        const alias = approve;
        const { isRunning, execute, ...rest } = alias;
        return (
          <main>
            <Spinner busy={isRunning} />
            <Label text={alias.status} />
            <Status action={approve} />
            <Runner action={alias} />
            <Forward action={approve} />
            <Picked action={rest} />
            <SaveBar onSave={execute} />
          </main>
        );
      }
    `);

    for (const name of ["Spinner", "Label", "Status"]) expect(componentOf(result, name).actionKeys).toEqual([]);
    for (const name of ["Runner", "Forward", "Picked", "SaveBar", "App"]) expect(componentOf(result, name).actionKeys).toEqual(["approve"]);
  });

  it("props.action.execute 는 실행을, props.action.isRunning 은 표시만 넘긴다", () => {
    const result = analyzeActions(`
      function SaveBar({ onSave }) { return <button onClick={() => onSave()} />; }
      function Spinner({ busy }) { return <span>{busy ? "..." : ""}</span>; }
      function Panel(props) {
        return <div><SaveBar onSave={props.action.execute} /><Spinner busy={!!props.action.isRunning} /></div>;
      }
      function App() {
        const approve = useOntologyAction(ACTIONS.approve, { tenantId: TENANT_ID });
        return <Panel action={approve} />;
      }
    `);

    expect(componentOf(result, "SaveBar").actionKeys).toEqual(["approve"]);
    expect(componentOf(result, "Spinner").actionKeys).toEqual([]);
    expect(componentOf(result, "Panel").actionKeys).toEqual(["approve"]);
  });

  it("결과를 spread 로 넘기면 execute 를 꺼낸 자식만 액션을 쓴다", () => {
    const result = analyzeActions(`
      function Row({ execute, isRunning }) { return <button disabled={isRunning} onClick={execute} />; }
      function Badge({ status }) { return <span>{status}</span>; }
      function Via(props) { return <button onClick={() => props.execute()} />; }
      function Inner({ onRun }) { return <button onClick={onRun} />; }
      function Relay({ execute }) { return <Inner onRun={execute} />; }
      function App() {
        const approve = useOntologyAction(ACTIONS.approve, { tenantId: TENANT_ID });
        return <main><Row {...approve} /><Badge {...approve} /><Via {...approve} /><Relay {...approve} /></main>;
      }
    `);

    for (const name of ["Row", "Via", "Relay", "Inner"]) expect(componentOf(result, name).actionKeys).toEqual(["approve"]);
    expect(componentOf(result, "Badge").actionKeys).toEqual([]);
  });

  it("FUNCTIONS 와 ACTIONS 의 같은 key 는 섞이지 않는다", () => {
    const result = analyzeActions(`
      function Panel({ rows, onSave }) { return <div>{rows.length}<button onClick={() => onSave()} /></div>; }
      function App() {
        const saved = useOntologyFunction(FUNCTIONS.save, { tenantId: TENANT_ID });
        const save = useOntologyAction(ACTIONS.save, { tenantId: TENANT_ID });
        return <Panel rows={saved.data} onSave={save.execute} />;
      }
    `);

    for (const name of ["Panel", "App"]) {
      expect(componentOf(result, name)).toMatchObject({ functionIds: ["uuid-fn-save"], actionIds: ["uuid-act-save"] });
    }
    expect(componentOf(result, "App").bindings.map((b) => [b.prop, b.functionIds])).toEqual([["rows", ["uuid-fn-save"]]]);
  });

  it("액션 계약을 벗어난 모양을 actionViolations 로 보고한다", () => {
    const result = analyzeActions(`
      function useOntologyAction() { return null; }
      function App() {
        const a = useOntologyAction({ id: "forged-uuid" }, { tenantId: TENANT_ID });
        const b = useOntologyAction(ACTIONS.missing, { tenantId: TENANT_ID });
        const c = useOntologyAction(ACTIONS[name], { tenantId: TENANT_ID });
        register(ACTIONS);
        const run = () => apiClient.post(\`/ontology-actions/\${ACTIONS.approve.id}/execute\`, {});
        return <div />;
      }
    `);

    expect(result.actionViolations.map((v) => v.rule).sort()).toEqual([
      "action-hook-redefined",
      "actions-dynamic-key",
      "actions-escape",
      "actions-outside-hook",
      "direct-action-call",
      "hook-arg-not-actions",
      "hook-arg-not-actions",
      "unknown-action-key",
    ]);
    expect(result.actionViolations.every((v) => /^src\/App\.tsx:\d+:\d+$/.test(v.loc))).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("함수 hook 을 쓰며 /execute 를 직접 부르는 기존 앱은 actionViolations 에만 들어간다", () => {
    const result = analyzeActions(`
      export default function App() {
        const orders = useOntologyFunction(FUNCTIONS.orders, { tenantId: TENANT_ID });
        const approve = (id) =>
          apiClient.post(\`/ontology-actions/\${ACTIONS.approve.id}/execute\`, { input: { id } }, { headers: { "X-Tenant-Id": TENANT_ID } });
        return <button onClick={() => approve(orders.data[0].id)} />;
      }
    `);

    expect(result.violations).toEqual([]);
    expect(result.usesHook).toBe(true);
    expect(result.actionViolations.map((v) => v.rule).sort()).toEqual(["actions-outside-hook", "direct-action-call"]);
    expect(result.usesActionHook).toBe(false);
  });

  it("템플릿 액션 hook 파일은 /ontology-actions/ 를 직접 불러도 위반이 아니다", () => {
    const result = analyzeActions(
      "export function useOntologyAction(action, o) { return apiClient.post(`/ontology-actions/${action.id}/runs`, {}); }",
      "src/hooks/useOntologyAction.ts",
    );

    expect(result.actionViolations).toEqual([]);
    expect(result.violations).toEqual([]);
  });
});
