import { isFunctionNode, locOf, type Node, unwrap, walk } from "./aos-ast";
import type { DataflowResult } from "./aos-dataflow";

// 컴포넌트 안 차트의 "어떻게 그렸나" 명세 추출 (AOS-4929 위젯).
//
// 위젯을 홈에 붙일 때 앱 번들을 띄우지 않고 호스트가 자기 차트로 다시 그리려면(DECLARATIVE)
// 라이브러리 · 차트 종류 · 필드 매핑 · 데이터 출처가 필요하다. 빌드 시점에 AST 에서 한 번 뽑아
// 매니페스트에 싣고, 위젯을 만들 때 그 명세를 복사해 저장한다 — 홈에서 렌더할 때는 소스를 다시
// 보지 않는다.
//
// 재현 가능(reproducible) 판정은 보수적으로 한다. 아니면 위젯은 IFRAME(앱의 그 부분을 그대로
// 띄움)으로 간다 — 틀린 차트를 그리는 것보다 낫다.

export type VizLibrary = "synapse" | "recharts" | "echarts";
export type VizKind = "BAR" | "LINE" | "AREA" | "PIE" | "SCATTER" | "KPI" | "OTHER";

export interface AosVisualization {
  library: VizLibrary;
  /** 소스의 JSX 엘리먼트 이름 */
  element: string;
  kind: VizKind;
  loc: string;
  /** 정규화한 명세 — 호스트가 synapse charts 로 그릴 때 그대로 쓴다. `data` 는 빠져 있다 */
  spec: { component: string; props: Record<string, unknown> };
  /** data prop 의 출처. 정적 데이터면 null */
  data: { functions: string[]; direct: boolean } | null;
  /** 정적으로 읽지 못한 표현 prop (재현 판정에 영향) */
  dynamicProps: string[];
  reproducible: boolean;
  /** reproducible 이 false 인 이유 (true 면 null) */
  reason: string | null;
}

const SYNAPSE_CHART_MODULES = new Set(["@enhans/synapse/charts"]);
const RECHARTS_MODULE = "recharts";
const ECHARTS_MODULES = new Set(["echarts", "echarts-for-react"]);

const SYNAPSE_KINDS: Record<string, VizKind> = {
  BarChart: "BAR",
  LineChart: "LINE",
  AreaChart: "AREA",
  PieChart: "PIE",
  ScatterChart: "SCATTER",
  KpiCard: "KPI",
};
const RECHARTS_CONTAINERS: Record<string, VizKind> = {
  BarChart: "BAR",
  LineChart: "LINE",
  AreaChart: "AREA",
  PieChart: "PIE",
  ScatterChart: "SCATTER",
};
const RECHARTS_SERIES = new Set(["Line", "Bar", "Area", "Scatter"]);

// 재현 판정에서 무시하는 동적 prop — 호스트가 자기 테마·크기로 다시 정한다
const PRESENTATION_PROPS = new Set([
  "key",
  "className",
  "style",
  "colors",
  "color",
  "height",
  "width",
  "empty",
  "emptyText",
  "loading",
  "isLoading",
  "legend",
  "tooltip",
  "optionOverrides",
]);

interface ImportInfo {
  module: string;
  imported: string;
}

function collectImports(program: Node): Map<string, ImportInfo> {
  const imports = new Map<string, ImportInfo>();
  for (const stmt of program.body as Node[]) {
    if (stmt.type !== "ImportDeclaration") continue;
    const module = (stmt.source as Node).value as string;
    for (const spec of stmt.specifiers as Node[]) {
      const local = (spec.local as Node).name as string;
      const imported =
        spec.type === "ImportSpecifier"
          ? (((spec.imported as Node).name ?? (spec.imported as Node).value) as string)
          : "default";
      imports.set(local, { module, imported });
    }
  }
  return imports;
}

/** 리터럴(문자열·숫자·불리언·null, 그 배열·객체)이면 값을, 아니면 undefined */
function literalValue(node: Node): unknown {
  const n = unwrap(node);
  switch (n.type) {
    case "StringLiteral":
    case "NumericLiteral":
    case "BooleanLiteral":
      return n.value;
    case "NullLiteral":
      return null;
    case "TemplateLiteral":
      return (n.expressions as Node[]).length === 0
        ? ((n.quasis as Node[])[0].value as { cooked: string }).cooked
        : undefined;
    case "UnaryExpression":
      if (n.operator === "-" && (n.argument as Node).type === "NumericLiteral") {
        return -((n.argument as Node).value as number);
      }
      return undefined;
    case "ArrayExpression": {
      const out: unknown[] = [];
      for (const el of n.elements as (Node | null)[]) {
        if (!el) return undefined;
        const v = literalValue(el);
        if (v === undefined) return undefined;
        out.push(v);
      }
      return out;
    }
    case "ObjectExpression": {
      const out: Record<string, unknown> = {};
      for (const prop of n.properties as Node[]) {
        if (prop.type !== "ObjectProperty" || prop.computed) return undefined;
        const key = prop.key as Node;
        const name = key.type === "Identifier" ? (key.name as string) : (key.value as string);
        const v = literalValue(prop.value as Node);
        if (v === undefined) return undefined;
        out[name] = v;
      }
      return out;
    }
    default:
      return undefined;
  }
}

interface ReadAttrs {
  props: Record<string, unknown>;
  dynamic: string[];
  dataAttr: Node | null;
}

/** JSX 속성을 정적 props / 동적 prop 이름 / data 속성으로 나눈다. 함수 prop(onClick 등)은 버린다 */
function readAttributes(opening: Node): ReadAttrs {
  const props: Record<string, unknown> = {};
  const dynamic: string[] = [];
  let dataAttr: Node | null = null;
  for (const attr of opening.attributes as Node[]) {
    if (attr.type === "JSXSpreadAttribute") {
      dynamic.push("...spread");
      continue;
    }
    const name = (attr.name as Node).name as string;
    if (name.startsWith("data-aos-")) continue;
    if (name === "data") {
      dataAttr = attr;
      continue;
    }
    const value = attr.value as Node | null;
    if (value === null) {
      props[name] = true; // `<BarChart stacked />`
      continue;
    }
    const expr = value.type === "JSXExpressionContainer" ? (value.expression as Node) : value;
    if (isFunctionNode(unwrap(expr))) continue;
    const literal = literalValue(expr);
    if (literal === undefined) dynamic.push(name);
    else props[name] = literal;
  }
  return { props, dynamic, dataAttr };
}

function jsxElementName(opening: Node): string {
  const name = opening.name as Node;
  return name.type === "JSXIdentifier" ? (name.name as string) : "";
}

/** recharts 컨테이너의 자식(XAxis / Line / Bar / Pie)에서 필드 매핑을 뽑아 synapse 명세로 정규화 */
function normalizeRecharts(
  element: Node,
  kind: VizKind,
  imports: Map<string, ImportInfo>,
): { props: Record<string, unknown>; dynamic: string[] } {
  const props: Record<string, unknown> = {};
  const dynamic: string[] = [];
  const yFields: string[] = [];
  const childName = (opening: Node) => {
    const local = jsxElementName(opening);
    const info = imports.get(local);
    return info && info.module === RECHARTS_MODULE ? info.imported : null;
  };
  walk(element, (node) => {
    if (node.type !== "JSXOpeningElement" || node === element.openingElement) return;
    const name = childName(node);
    if (!name) return;
    const { props: attrs, dynamic: dyn } = readAttributes(node);
    if (name === "XAxis" && "dataKey" in attrs) props.xField = attrs.dataKey;
    else if (RECHARTS_SERIES.has(name)) {
      if (typeof attrs.dataKey === "string") yFields.push(attrs.dataKey);
      if (attrs.stackId !== undefined) props.stacked = true;
      if (attrs.type === "monotone") props.smooth = true;
    } else if (name === "Pie") {
      if ("dataKey" in attrs) props.valueField = attrs.dataKey;
      if ("nameKey" in attrs) props.nameField = attrs.nameKey;
      if (attrs.innerRadius !== undefined) props.donut = true;
    }
    for (const d of dyn) if (d === "dataKey" || d === "nameKey") dynamic.push(`${name}.${d}`);
  });
  if (kind !== "PIE" && yFields.length > 0) props.yField = yFields.length === 1 ? yFields[0] : yFields;
  if (kind === "AREA") props.area = true;
  return { props, dynamic };
}

function judge(viz: Omit<AosVisualization, "reproducible" | "reason">): { reproducible: boolean; reason: string | null } {
  if (viz.library === "echarts") return { reproducible: false, reason: "echarts option 직접 구성 — 호스트 재현 미지원" };
  if (viz.kind === "KPI" || viz.kind === "OTHER") return { reproducible: false, reason: `${viz.element} 는 아직 선언형 재현 대상이 아님` };
  if (!viz.data) return { reproducible: false, reason: "data 가 OntologyFunction 결과가 아님 (정적 데이터)" };
  if (viz.data.functions.length !== 1) return { reproducible: false, reason: "data 가 함수 여러 개를 조합함" };
  if (!viz.data.direct) return { reproducible: false, reason: "data 가 useMemo 등으로 변환된 값" };
  const blocking = viz.dynamicProps.filter((p) => !PRESENTATION_PROPS.has(p));
  if (blocking.length > 0) return { reproducible: false, reason: `정적으로 읽을 수 없는 prop: ${blocking.join(", ")}` };
  return { reproducible: true, reason: null };
}

/** 컴포넌트 이름 → 그 컴포넌트 안의 시각화 목록 */
export function extractVisualizations(ast: Node, file: string, flow: DataflowResult): Map<string, AosVisualization[]> {
  const program = (ast.type === "File" ? ast.program : ast) as Node;
  const imports = collectImports(program);
  const byComponent = new Map<string, AosVisualization[]>();
  const owner = (pos: number) => flow.components.find((c) => c.start <= pos && pos < c.end) ?? null;
  const toIds = (keys: string[]) => keys.map((k) => flow.functionIds.get(k)).filter((id): id is string => !!id);

  walk(program, (node) => {
    if (node.type !== "JSXElement") return;
    const opening = node.openingElement as Node;
    const info = imports.get(jsxElementName(opening));
    if (!info) return;

    let library: VizLibrary | null = null;
    let kind: VizKind = "OTHER";
    if (SYNAPSE_CHART_MODULES.has(info.module) && info.imported in SYNAPSE_KINDS) {
      library = "synapse";
      kind = SYNAPSE_KINDS[info.imported];
    } else if (info.module === RECHARTS_MODULE && info.imported in RECHARTS_CONTAINERS) {
      library = "recharts";
      kind = RECHARTS_CONTAINERS[info.imported];
    } else if (ECHARTS_MODULES.has(info.module)) {
      library = "echarts";
    }
    if (!library) return;

    const comp = owner(node.start);
    if (!comp) return;
    const { props, dynamic, dataAttr } = readAttributes(opening);
    let specProps = props;
    const dynamicProps = [...dynamic];
    if (library === "recharts") {
      const normalized = normalizeRecharts(node, kind, imports);
      specProps = normalized.props;
      dynamicProps.push(...normalized.dynamic);
    }
    const dataLoc = dataAttr ? locOf(file, dataAttr) : null;
    const binding = dataLoc ? comp.bindings.find((b) => b.loc === dataLoc && b.prop === "data") : undefined;

    const base = {
      library,
      element: info.imported,
      kind,
      loc: locOf(file, opening),
      spec: { component: info.imported, props: specProps },
      data: binding ? { functions: toIds(binding.functionKeys), direct: binding.direct } : null,
      dynamicProps: [...new Set(dynamicProps)],
    };
    const list = byComponent.get(comp.name) ?? [];
    list.push({ ...base, ...judge(base) });
    byComponent.set(comp.name, list);
  });

  return byComponent;
}
