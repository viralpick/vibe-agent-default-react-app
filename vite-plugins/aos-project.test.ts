import { describe, expect, it } from "vitest";
import { analyzeProjectDataflow } from "./aos-dataflow";
import { analyzeProject, aosKey, fileSignatures, staleFiles } from "./aos-locator";
import { AosProject, findCycles } from "./aos-project";

// 멀티모듈 앱 (AOS-4902) — GUIDE 의 파일 분할 규약 그대로:
//   src/App.tsx · src/app/constants.ts · src/app/components/<Name>.tsx · src/app/types.ts

const CONSTANTS = `
export const FUNCTIONS = {
  orders: { id: "uuid-orders", description: "주문" },
  brands: { id: "uuid-brands", description: "브랜드" },
};
export const ACTIONS = {};
export const TENANT_ID = "1";
`;

const TYPES = `export interface Row { month: string; amount: number }`;

const APP = `
import { useOntologyFunction } from "@/hooks/useOntologyFunction";
import { FUNCTIONS, TENANT_ID } from "@/app/constants";
import { SalesChart } from "@/app/components/SalesChart";
import { BrandCard } from "./app/components/BrandCard";
import type { Row } from "@/app/types";

export default function App() {
  const orders = useOntologyFunction<Row>(FUNCTIONS.orders, { tenantId: TENANT_ID });
  return (
    <main>
      <div className="grid">
        <SalesChart rows={orders.data} />
      </div>
      <BrandCard />
    </main>
  );
}
`;

const SALES_CHART = `
import { BarChart } from "@enhans/synapse/charts";
import type { Row } from "@/app/types";

export function SalesChart({ rows }: { rows: Row[] }) {
  return (
    <section data-aos-id="sales-chart" data-aos-name="SalesChart">
      <BarChart data={rows} xField="month" yField="amount" />
    </section>
  );
}
`;

const BRAND_CARD = `
import { useOntologyFunction } from "@/hooks/useOntologyFunction";
import { FUNCTIONS, TENANT_ID } from "@/app/constants";

export function BrandCard() {
  const brands = useOntologyFunction(FUNCTIONS.brands, { tenantId: TENANT_ID });
  return <div data-aos-id="brand-card">{brands.data.length}</div>;
}
`;

// 템플릿 hook 과 같은 모양 — 직접 /run 을 부르는 유일하게 허용된 자리
const HOOK = "export function useOntologyFunction(fn, options) { apiClient.post(`/ontology-functions/${fn.id}/run`); return { data: [] }; }";

function dashboard(overrides: Record<string, string> = {}) {
  return AosProject.fromSources({
    "src/hooks/useOntologyFunction.ts": HOOK,
    "src/app/constants.ts": CONSTANTS,
    "src/app/types.ts": TYPES,
    "src/App.tsx": APP,
    "src/app/components/SalesChart.tsx": SALES_CHART,
    "src/app/components/BrandCard.tsx": BRAND_CARD,
    ...overrides,
  });
}

describe("AosProject — 모듈 해석", () => {
  it("@/ 알리아스 · 상대 경로 · 확장자 생략 · index · .js 표기를 프로젝트 파일로 푼다", () => {
    const project = AosProject.fromSources({
      "src/App.tsx": "",
      "src/app/constants.ts": "",
      "src/app/components/index.ts": "",
      "src/app/utils/format.ts": "",
    });

    expect(project.resolve("src/App.tsx", "@/app/constants")).toBe("src/app/constants.ts");
    expect(project.resolve("src/App.tsx", "./app/components")).toBe("src/app/components/index.ts");
    expect(project.resolve("src/app/components/index.ts", "../utils/format.js")).toBe("src/app/utils/format.ts");
    expect(project.resolve("src/App.tsx", "recharts")).toBeNull();
    expect(project.resolve("src/App.tsx", "@/app/missing")).toBeNull();
  });

  it("export 를 따라 선언을 찾는다 — 별칭 · default · 재수출 · export *", () => {
    const project = AosProject.fromSources({
      "src/App.tsx": `
        import { Chart as Trend } from "./app/charts";
        import Card from "./app/Card";
        import { Grid } from "./app";
        import { BarChart } from "recharts";
      `,
      "src/app/charts.tsx": "export function Chart() { return <div />; }",
      "src/app/Card.tsx": "function Card() { return <div />; }\nexport default memo(Card);",
      "src/app/index.ts": `export * from "./layout";`,
      "src/app/layout.tsx": "const Inner = () => <div />;\nexport { Inner as Grid };",
    });

    expect(project.resolveName("src/App.tsx", "Trend")).toEqual({ file: "src/app/charts.tsx", local: "Chart" });
    expect(project.resolveName("src/App.tsx", "Card")).toEqual({ file: "src/app/Card.tsx", local: "Card" });
    expect(project.resolveName("src/App.tsx", "Grid")).toEqual({ file: "src/app/layout.tsx", local: "Inner" });
    expect(project.resolveName("src/App.tsx", "BarChart")).toBe("external");
    expect(project.resolveName("src/App.tsx", "Nope")).toBe("unbound");
  });
});

describe("멀티모듈 데이터 흐름", () => {
  it("다른 모듈의 FUNCTIONS 를 import 해도 위반 없이 추적한다", () => {
    const flows = analyzeProjectDataflow(dashboard());

    // hook 을 정의한 모듈의 /run 호출도 위반이 아니다
    for (const [, flow] of flows.files) expect(flow.violations).toEqual([]);
    expect(flows.files.get("src/App.tsx")!.functionIds.get("orders")).toBe("uuid-orders");
    expect(flows.files.get("src/app/components/BrandCard.tsx")!.components[0]).toMatchObject({
      id: "src/app/components/BrandCard.tsx#BrandCard",
      functionKeys: ["brands"],
      functionIds: ["uuid-brands"],
    });
  });

  it("FUNCTIONS 재수출(`export { FUNCTIONS } from`)도 따라간다", () => {
    const flows = analyzeProjectDataflow(
      dashboard({
        "src/app/index.ts": `export { FUNCTIONS } from "./constants";`,
        "src/app/components/BrandCard.tsx": BRAND_CARD.replace(`import { FUNCTIONS, TENANT_ID } from "@/app/constants";`, `import { FUNCTIONS } from "@/app";\nconst TENANT_ID = "1";`),
      }),
    );
    const card = flows.files.get("src/app/components/BrandCard.tsx")!;

    expect(card.violations).toEqual([]);
    expect(card.components[0].functionIds).toEqual(["uuid-brands"]);
  });

  it("앱 쪽 .ts 모듈의 직접 /run 호출은 여전히 위반이다", () => {
    const flows = analyzeProjectDataflow(
      dashboard({
        "src/app/utils/api.ts": `import { FUNCTIONS } from "@/app/constants";\nexport const run = (c) => c.post(\`/ontology-functions/\${FUNCTIONS.orders.id}/run\`);`,
      }),
    );

    expect(flows.files.get("src/app/utils/api.ts")!.violations.map((v) => v.rule).sort()).toEqual(["direct-run-call", "functions-outside-hook"]);
  });

  it("FUNCTIONS 를 못 찾는 hook 호출은 예전처럼 unknown-function-key 다", () => {
    const flows = analyzeProjectDataflow(
      dashboard({ "src/app/components/BrandCard.tsx": BRAND_CARD.replace("@/app/constants", "@/app/nowhere") }),
    );

    expect(flows.files.get("src/app/components/BrandCard.tsx")!.violations.map((v) => v.rule)).toEqual(["unknown-function-key"]);
  });

  it("App 이 조회해 다른 파일 컴포넌트에 넘긴 데이터를 그 컴포넌트의 함수로 잡는다", () => {
    const { results, manifest } = analyzeProject(dashboard(), { injectLoc: false });
    const chart = manifest.components.find((c) => c.id === "sales-chart")!;

    expect(chart).toMatchObject({
      file: "src/app/components/SalesChart.tsx",
      component: "SalesChart",
      functions: ["uuid-orders"],
      functionsSource: "inferred",
      bindings: [{ element: "BarChart", prop: "data", functions: ["uuid-orders"], direct: true }],
    });
    expect(results.get("src/app/components/SalesChart.tsx")!.code).toContain(`data-aos-functions="uuid-orders"`);
    expect(manifest.files.map((f) => f.file)).toEqual(["src/App.tsx", "src/app/components/BrandCard.tsx"]);
  });

  it("다른 파일 차트의 data 출처를 풀어 재현 가능으로 판정한다", () => {
    const { manifest } = analyzeProject(dashboard(), { injectLoc: false });
    const bar = manifest.visualizations.find((v) => v.kind === "BAR")!;
    const section = manifest.components.find((c) => c.id === "sales-chart")!;

    expect(section.loc).toBe("src/app/components/SalesChart.tsx:7:5");
    expect(bar).toMatchObject({
      component: "SalesChart",
      data: { functions: ["uuid-orders"], direct: true },
      reproducible: true,
      // 차트를 감싼 data-aos-id 엘리먼트(같은 파일)가 anchor 다
      anchors: [section.key],
    });
  });
});

describe("멀티모듈 anchors — 컴포넌트 정체는 파일#이름", () => {
  const CHART = (field: string) => `
    import { LineChart } from "@enhans/synapse/charts";
    export function Chart({ rows }) {
      return <LineChart data={rows} xField="${field}" yField="v" />;
    }
  `;
  const project = () =>
    dashboard({
      "src/App.tsx": `
        import { useOntologyFunction } from "@/hooks/useOntologyFunction";
        import { FUNCTIONS, TENANT_ID } from "@/app/constants";
        import { Chart as SalesTrend } from "./app/components/a/Chart";
        import { Chart } from "@/app/components/b/Chart";
        export default function App() {
          const orders = useOntologyFunction(FUNCTIONS.orders, { tenantId: TENANT_ID });
          const brands = useOntologyFunction(FUNCTIONS.brands, { tenantId: TENANT_ID });
          return (
            <main>
              <div className="left"><SalesTrend rows={orders.data} /></div>
              <div className="right"><Chart rows={brands.data} /></div>
            </main>
          );
        }
      `,
      "src/app/components/a/Chart.tsx": CHART("month"),
      "src/app/components/b/Chart.tsx": CHART("brand"),
    });

  it("같은 이름의 두 컴포넌트를 섞지 않고, 별칭 import 도 제자리로 잇는다", () => {
    const { manifest } = analyzeProject(project(), { injectLoc: false });
    const byField = (field: string) => manifest.visualizations.find((v) => v.spec.props.xField === field)!;

    expect(byField("month")).toMatchObject({
      data: { functions: ["uuid-orders"], direct: true },
      anchors: [aosKey("src/App.tsx:11:15")],
    });
    expect(byField("brand")).toMatchObject({
      data: { functions: ["uuid-brands"], direct: true },
      anchors: [aosKey("src/App.tsx:12:15")],
    });
  });
});

describe("import 그래프 — modules · cycles", () => {
  it("실행 시점 import 만 싣고 순환을 찾는다 (import type 은 순환이 아니다)", () => {
    const project = dashboard({
      "src/app/a.ts": `import { b } from "./b";\nexport const a = () => b;`,
      "src/app/b.ts": `import { a } from "./a";\nexport const b = () => a;`,
      "src/app/c.ts": `import type { A } from "./a";\nimport { type B } from "./b";\nexport const c = 1;`,
      "src/app/d.ts": `import { a } from "./a";\nimport { gone } from "@/app/gone";\nimport "./theme.css";`,
    });
    const { manifest } = analyzeProject(project, { injectLoc: false });
    const mod = (file: string) => manifest.modules.find((m) => m.file === file)!;

    expect(mod("src/app/c.ts").imports).toEqual([]);
    expect(mod("src/app/d.ts")).toEqual({ file: "src/app/d.ts", imports: ["src/app/a.ts"], unresolved: ["@/app/gone"] });
    expect(mod("src/App.tsx").imports).toEqual([
      "src/app/components/BrandCard.tsx",
      "src/app/components/SalesChart.tsx",
      "src/app/constants.ts",
      "src/hooks/useOntologyFunction.ts",
    ]);
    expect(manifest.cycles).toEqual([["src/app/a.ts", "src/app/b.ts"]]);
  });

  it("자기 자신을 import 하면 크기 1 순환이다", () => {
    expect(findCycles(new Map([["x", ["x"]], ["y", ["x"]]]))).toEqual([["x"]]);
  });
});

describe("dev 무효화 — 다른 파일 때문에 주입값이 바뀐 모듈", () => {
  it("App 이 넘기는 데이터를 바꾸면 그 데이터를 받는 다른 파일이 낡는다", () => {
    const project = dashboard();
    const before = fileSignatures(analyzeProjectDataflow(project));
    project.set("src/App.tsx", APP.replace("FUNCTIONS.orders", "FUNCTIONS.brands"));
    const after = fileSignatures(analyzeProjectDataflow(project));

    expect(staleFiles(before, after, "src/App.tsx")).toEqual(["src/app/components/SalesChart.tsx"]);
  });

  it("FUNCTIONS 의 UUID 를 바꾸면 그것을 쓰는 모든 파일이 낡는다", () => {
    const project = dashboard();
    const before = fileSignatures(analyzeProjectDataflow(project));
    project.set("src/app/constants.ts", CONSTANTS.replace("uuid-orders", "uuid-orders-v2"));
    const after = fileSignatures(analyzeProjectDataflow(project));

    expect(staleFiles(before, after, "src/app/constants.ts")).toEqual(["src/App.tsx", "src/app/components/SalesChart.tsx"]);
  });

  it("주입값과 무관한 변경은 다른 파일을 건드리지 않는다", () => {
    const project = dashboard();
    const before = fileSignatures(analyzeProjectDataflow(project));
    project.set("src/App.tsx", APP.replace(`className="grid"`, `className="grid gap-4"`));

    expect(staleFiles(before, fileSignatures(analyzeProjectDataflow(project)), "src/App.tsx")).toEqual([]);
  });
});
