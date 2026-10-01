import { describe, expect, it } from "vitest";
import { analyzeAosSource, buildManifest } from "./aos-locator";

const FILE = "src/App.tsx";

function inject(code: string) {
  return analyzeAosSource(code, FILE, { injectLoc: true });
}

describe("analyzeAosSource — data-aos-loc 주입", () => {
  it("host 엘리먼트에 1-based 라인:칼럼 좌표를 주입한다", () => {
    const result = inject(`const A = () => (\n  <div className="x">\n    <span>hi</span>\n  </div>\n);`);

    expect(result.code).toContain(`<div data-aos-loc="src/App.tsx:2:3" className="x">`);
    expect(result.code).toContain(`<span data-aos-loc="src/App.tsx:3:5">`);
  });

  it("data-aos-id 가 없는 컴포넌트에는 주입하지 않는다 (rest props 미전달 시 속성이 사라진다)", () => {
    const result = inject(`const A = () => <Card title="t"><div /></Card>;`);

    expect(result.code).toContain(`<Card title="t">`);
    expect(result.code).toContain(`<div data-aos-loc=`);
  });

  it("data-aos-id 가 붙은 컴포넌트에는 주입한다", () => {
    const result = inject(`const A = () => <Card data-aos-id="sales-chart" />;`);

    expect(result.code).toContain(`<Card data-aos-loc="src/App.tsx:1:17" data-aos-id="sales-chart" />`);
  });

  it("Fragment 에는 주입하지 않는다 (React 경고)", () => {
    const result = inject(
      `const A = () => <React.Fragment><Fragment key="k"><></></Fragment></React.Fragment>;`,
    );

    expect(result.code).toBeNull();
  });

  it("이미 data-aos-loc 가 있으면 덮어쓰지 않는다", () => {
    const result = inject(`const A = () => <div data-aos-loc="keep" />;`);

    expect(result.code).toBeNull();
  });

  it("제네릭 컴포넌트는 타입 인자 뒤에 주입해 문법을 유지한다", () => {
    const result = inject(`const A = () => <Select<Option> data-aos-id="picker" />;`);

    expect(result.code).toContain(`<Select<Option> data-aos-loc=`);
  });

  it("주입 대상 외 코드는 그대로 두고 sourcemap 을 함께 돌려준다", () => {
    const code = `import x from "y";\nconst A = () => <div />;\n`;
    const result = inject(code);

    expect(result.code).toBe(`import x from "y";\nconst A = () => <div data-aos-loc="src/App.tsx:2:17" />;\n`);
    expect(result.map?.mappings).toBeTruthy();
  });

  it("injectLoc=false (build) 이면 코드를 바꾸지 않는다", () => {
    const result = analyzeAosSource(`const A = () => <div data-aos-id="a" />;`, FILE, { injectLoc: false });

    expect(result.code).toBeNull();
    expect(result.components).toHaveLength(1);
  });

  it("문법 오류가 있어도 예외를 던지지 않는다", () => {
    expect(() => inject(`const A = () => <div>`)).not.toThrow();
  });
});

describe("analyzeAosSource — 컴포넌트 수집", () => {
  it("data-aos-id / name / functions 를 수집한다", () => {
    const result = inject(
      `const A = () => (
        <Card data-aos-id="sales-chart" data-aos-name="SalesChart" data-aos-functions="f-1, f-2">
          <BarChart data={d} />
        </Card>
      );`,
    );

    expect(result.components).toEqual([
      {
        id: "sales-chart",
        name: "SalesChart",
        element: "Card",
        functions: ["f-1", "f-2"],
        functionsSource: "explicit",
        functionsInferred: [],
        component: "A",
        bindings: [],
        visualizations: [],
        functionsExpression: null,
        loc: "src/App.tsx:2:9",
      },
    ]);
  });

  it("중괄호 문자열·템플릿 리터럴도 정적 값으로 읽는다", () => {
    const result = inject(
      "const A = () => <section data-aos-id={`kpi-row`} data-aos-functions={\"f-1\"} />;",
    );

    expect(result.components[0]).toMatchObject({ id: "kpi-row", functions: ["f-1"], name: null });
  });

  it("정적으로 해석할 수 없는 functions 는 표현식 원문을 남긴다", () => {
    const result = inject(`const A = () => <Card data-aos-id="c" data-aos-functions={ids.join(",")} />;`);

    expect(result.components[0]).toMatchObject({ functions: [], functionsExpression: `{ids.join(",")}` });
  });

  it("동적 data-aos-id 는 수집하지 않는다", () => {
    const result = inject("const A = () => rows.map((r) => <Card key={r.id} data-aos-id={r.id} />);");

    expect(result.components).toEqual([]);
  });
});

describe("buildManifest", () => {
  it("좌표 순으로 정렬하고 중복 id 를 표시한다", () => {
    const base = {
      name: null,
      element: "Card",
      functions: [],
      functionsSource: "none" as const,
      functionsInferred: [],
      component: null,
      bindings: [],
      visualizations: [],
      functionsExpression: null,
    };
    const manifest = buildManifest([
      { ...base, id: "b", loc: "src/App.tsx:10:1" },
      { ...base, id: "a", loc: "src/App.tsx:9:1" },
      { ...base, id: "b", loc: "src/App.tsx:30:1" },
    ]);

    expect(manifest.version).toBe(3);
    expect(manifest.components.map((c) => c.loc)).toEqual([
      "src/App.tsx:9:1",
      "src/App.tsx:10:1",
      "src/App.tsx:30:1",
    ]);
    expect(manifest.duplicateIds).toEqual(["b"]);
  });
});

describe("analyzeAosSource — data-aos-functions 추적 주입 (AOS-4888-a)", () => {
  const APP = `
    const FUNCTIONS = { brand_list: { id: "uuid-brand" }, monthly: { id: "uuid-monthly" } };
    function BrandTable({ rows }) {
      return <section data-aos-id="brand-table"><DataTable data={rows} /></section>;
    }
    function Trend({ rows }) {
      return <section data-aos-id="trend" data-aos-functions="uuid-written-by-llm">{rows.length}</section>;
    }
    export default function App() {
      const brands = useOntologyFunction(FUNCTIONS.brand_list, { tenantId: "1" });
      const monthly = useOntologyFunction(FUNCTIONS.monthly, { tenantId: "1" });
      return <main><BrandTable rows={brands.data} /><Trend rows={monthly.data} /></main>;
    }
  `;

  it("LLM 이 쓰지 않은 컴포넌트에는 추적한 UUID 를 build 에서도 주입한다", () => {
    const result = analyzeAosSource(APP, FILE, { injectLoc: false });

    expect(result.code).toContain(`<section data-aos-functions="uuid-brand" data-aos-id="brand-table">`);
    expect(result.code).not.toContain("data-aos-loc");
    expect(result.components.find((c) => c.id === "brand-table")).toMatchObject({
      functions: ["uuid-brand"],
      functionsSource: "inferred",
      component: "BrandTable",
      bindings: [{ element: "DataTable", prop: "data", functions: ["uuid-brand"], direct: true }],
    });
  });

  it("LLM 이 이미 쓴 값은 덮어쓰지 않고 추적값을 따로 남긴다", () => {
    const result = analyzeAosSource(APP, FILE, { injectLoc: false });
    const trend = result.components.find((c) => c.id === "trend")!;

    expect(result.code).toContain(`data-aos-functions="uuid-written-by-llm"`);
    expect(trend).toMatchObject({
      functions: ["uuid-written-by-llm"],
      functionsSource: "explicit",
      functionsInferred: ["uuid-monthly"],
    });
  });

  it("파일 단위로 hook 사용 여부와 위반을 보고하고, 매니페스트는 관련 파일만 싣는다", () => {
    const legacy = analyzeAosSource(
      "const FUNCTIONS = { a: { id: 'u' } };\nfunction App() { apiClient.post(`/ontology-functions/${FUNCTIONS.a.id}/run`); return <div data-aos-id='app' />; }",
      FILE,
      { injectLoc: false },
    );
    const util = analyzeAosSource("export const Hi = () => <span>hi</span>;", "src/utils/hi.tsx", { injectLoc: false });

    expect(legacy.file.usesHook).toBe(false);
    expect(legacy.file.violations.map((v) => v.rule).sort()).toEqual(["direct-run-call", "functions-outside-hook"]);
    expect(buildManifest([...legacy.components, ...util.components], [legacy.file, util.file]).files.map((f) => f.file)).toEqual([FILE]);
  });
});
