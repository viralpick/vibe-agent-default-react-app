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
    const base = { name: null, element: "Card", functions: [], functionsExpression: null };
    const manifest = buildManifest([
      { ...base, id: "b", loc: "src/App.tsx:10:1" },
      { ...base, id: "a", loc: "src/App.tsx:9:1" },
      { ...base, id: "b", loc: "src/App.tsx:30:1" },
    ]);

    expect(manifest.version).toBe(1);
    expect(manifest.components.map((c) => c.loc)).toEqual([
      "src/App.tsx:9:1",
      "src/App.tsx:10:1",
      "src/App.tsx:30:1",
    ]);
    expect(manifest.duplicateIds).toEqual(["b"]);
  });
});
