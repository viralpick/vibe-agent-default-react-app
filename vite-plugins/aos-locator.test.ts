import { describe, expect, it } from "vitest";
import { analyzeAosSource, aosKey, buildManifest } from "./aos-locator";

const FILE = "src/App.tsx";

// 좌표 주입을 보는 테스트에서는 키 속성을 걷어 내고 비교한다 (키는 아래 describe 에서 따로 본다)
const strip = (code: string | null) => code?.replace(/ data-aos-k="k[0-9a-z]+"/g, "") ?? null;

function inject(code: string) {
  return analyzeAosSource(code, FILE, { injectLoc: true });
}

describe("analyzeAosSource — data-aos-loc 주입", () => {
  it("host 엘리먼트에 1-based 라인:칼럼 좌표를 주입한다", () => {
    const result = inject(`const A = () => (\n  <div className="x">\n    <span>hi</span>\n  </div>\n);`);

    expect(strip(result.code)).toContain(`<div data-aos-loc="src/App.tsx:2:3" className="x">`);
    expect(strip(result.code)).toContain(`<span data-aos-loc="src/App.tsx:3:5">`);
  });

  it("data-aos-id 가 없는 컴포넌트에는 주입하지 않는다 (rest props 미전달 시 속성이 사라진다)", () => {
    const result = inject(`const A = () => <Card title="t"><div /></Card>;`);

    expect(strip(result.code)).toContain(`<Card title="t">`);
    expect(strip(result.code)).toContain(`<div data-aos-loc=`);
  });

  it("data-aos-id 가 붙은 컴포넌트에는 주입한다", () => {
    const result = inject(`const A = () => <Card data-aos-id="sales-chart" />;`);

    expect(strip(result.code)).toContain(`<Card data-aos-loc="src/App.tsx:1:17" data-aos-id="sales-chart" />`);
  });

  it("Fragment 에는 주입하지 않는다 (React 경고)", () => {
    const result = inject(
      `const A = () => <React.Fragment><Fragment key="k"><></></Fragment></React.Fragment>;`,
    );

    expect(strip(result.code)).toBeNull();
  });

  it("이미 data-aos-loc 가 있으면 덮어쓰지 않는다", () => {
    const result = inject(`const A = () => <div data-aos-loc="keep" />;`);

    expect(strip(result.code)).toBe(`const A = () => <div data-aos-loc="keep" />;`);
  });

  it("제네릭 컴포넌트는 타입 인자 뒤에 주입해 문법을 유지한다", () => {
    const result = inject(`const A = () => <Select<Option> data-aos-id="picker" />;`);

    expect(strip(result.code)).toContain(`<Select<Option> data-aos-loc=`);
  });

  it("주입 대상 외 코드는 그대로 두고 sourcemap 을 함께 돌려준다", () => {
    const code = `import x from "y";\nconst A = () => <div />;\n`;
    const result = inject(code);

    expect(strip(result.code)).toBe(`import x from "y";\nconst A = () => <div data-aos-loc="src/App.tsx:2:17" />;\n`);
    expect(result.map?.mappings).toBeTruthy();
  });

  it("injectLoc=false (build) 이면 좌표는 넣지 않고 키만 넣는다", () => {
    const result = analyzeAosSource(`const A = () => <div data-aos-id="a" />;`, FILE, { injectLoc: false });

    expect(result.code).toBe(`const A = () => <div data-aos-k="${aosKey("src/App.tsx:1:17")}" data-aos-id="a" />;`);
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
        key: aosKey("src/App.tsx:2:9"),
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
      { ...base, id: "b", loc: "src/App.tsx:10:1", key: "kb1" },
      { ...base, id: "a", loc: "src/App.tsx:9:1", key: "ka" },
      { ...base, id: "b", loc: "src/App.tsx:30:1", key: "kb2" },
    ]);

    expect(manifest.version).toBe(4);
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

    expect(strip(result.code)).toContain(`<section data-aos-functions="uuid-brand" data-aos-id="brand-table">`);
    expect(strip(result.code)).not.toContain("data-aos-loc");
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

    expect(strip(result.code)).toContain(`data-aos-functions="uuid-written-by-llm"`);
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

describe("data-aos-k 와 매니페스트 visualizations (AOS-5814)", () => {
  const CHARTS = "src/components/Charts.tsx";
  const APP_SRC = `
    import { BarChart, Bar, XAxis } from "recharts";
    import { CountryChart } from "./components/Charts";
    const FUNCTIONS = { country: { id: "uuid-country" } };
    export default function App() {
      const country = useOntologyFunction(FUNCTIONS.country, { tenantId: "1" });
      return (
        <main>
          <section className="card">
            <BarChart data={country.data}><XAxis dataKey="country" /><Bar dataKey="cnt" /></BarChart>
          </section>
          <div className="grid">
            <CountryChart rows={country.data} />
          </div>
        </main>
      );
    }
  `;
  const CHARTS_SRC = `
    import { LineChart, Line, XAxis } from "recharts";
    export function CountryChart({ rows }) {
      return <LineChart data={rows}><XAxis dataKey="month" /><Line dataKey="cnt" /></LineChart>;
    }
  `;

  const analyze = () => {
    const app = analyzeAosSource(APP_SRC, FILE, { injectLoc: false });
    const charts = analyzeAosSource(CHARTS_SRC, CHARTS, { injectLoc: false });
    const manifest = buildManifest(
      [...app.components, ...charts.components],
      [app.file, charts.file],
      [...app.visualizations, ...charts.visualizations],
      [...app.usages, ...charts.usages],
    );
    return { app, manifest };
  };

  it("키는 같은 좌표면 늘 같은 값이고 좌표마다 다르다", () => {
    expect(aosKey("src/App.tsx:3:5")).toBe(aosKey("src/App.tsx:3:5"));
    expect(aosKey("src/App.tsx:3:5")).not.toBe(aosKey("src/App.tsx:3:6"));
    expect(aosKey("src/App.tsx:3:5")).toMatch(/^k[0-9a-z]+$/);
  });

  it("build 번들에도 host 엘리먼트마다 키를 넣고 좌표는 넣지 않는다", () => {
    const { app } = analyze();

    expect(app.code).toContain(`<section data-aos-k="${aosKey("src/App.tsx:9:11")}" className="card">`);
    expect(app.code).not.toContain("data-aos-loc");
    // 차트(라이브러리 컴포넌트)에는 넣지 않는다 — 속성이 DOM 까지 내려간다는 보장이 없다
    expect(app.code).toContain("<BarChart data={country.data}>");
  });

  it("같은 파일의 차트는 감싼 host 엘리먼트를 anchor 로 갖는다", () => {
    const { manifest } = analyze();
    const bar = manifest.visualizations.find((v) => v.kind === "BAR")!;

    expect(bar).toMatchObject({
      key: aosKey(bar.loc),
      component: "App",
      anchors: [aosKey("src/App.tsx:9:11")],
      spec: { props: { xField: "country", yField: "cnt" } },
      data: { functions: ["uuid-country"], direct: true },
      reproducible: true,
    });
  });

  it("컴포넌트 루트가 차트면 그 컴포넌트를 쓰는 자리의 host 엘리먼트를 anchor 로 갖는다", () => {
    const { manifest } = analyze();
    const line = manifest.visualizations.find((v) => v.kind === "LINE")!;

    expect(line.component).toBe("CountryChart");
    expect(line.anchors).toEqual([aosKey("src/App.tsx:12:11")]);
  });

  it("선택한 영역의 키와 anchors 를 맞추면 그 영역 안의 차트를 고를 수 있다", () => {
    const { manifest } = analyze();
    const inside = (keys: string[]) =>
      manifest.visualizations.filter((v) => v.anchors.some((a) => keys.includes(a))).map((v) => v.kind);
    const main = aosKey("src/App.tsx:8:9");
    const card = aosKey("src/App.tsx:9:11");
    const grid = aosKey("src/App.tsx:12:11");

    expect(inside([card])).toEqual(["BAR"]);
    expect(inside([grid])).toEqual(["LINE"]);
    expect(inside([main, card, grid])).toEqual(["BAR", "LINE"]);
  });
});
