import { isFunctionNode, isPascalCase, locOf, type Node, unwrap, walk } from "./aos-ast";
import type { DataflowResult } from "./aos-dataflow";
import { type AosRecipe, buildRecipe, type RecipeContext, resolveDefinition } from "./aos-recipe";

// 컴포넌트 안 차트의 "어떻게 그렸나" 명세 추출 (AOS-4929 위젯).
//
// 위젯을 홈에 붙일 때 앱 번들을 띄우지 않고 호스트가 자기 차트로 다시 그리려면(DECLARATIVE)
// 라이브러리 · 차트 종류 · 필드 매핑 · 데이터 출처가 필요하다. 빌드 시점에 AST 에서 한 번 뽑아
// 매니페스트에 싣고, 위젯을 만들 때 그 명세를 복사해 저장한다 — 홈에서 렌더할 때는 소스를 다시
// 보지 않는다.
//
// 재현 가능(reproducible) 판정은 보수적으로 한다. 아니면 위젯은 IFRAME(앱의 그 부분을 그대로
// 띄움)으로 간다 — 틀린 차트를 그리는 것보다 낫다.
//
// AOS-6186: 값이 가공된 것이어도 가공 코드를 닫힌 함수로 옮길 수 있으면(aos-recipe) 재현 가능이다 — 홈이
// 원본 행에 그 레시피를 다시 적용한다. 차트 외에 KPI 카드(`value` + `label`/`title` 을 받는 카드 — 앱이 직접
// 만든 카드 포함)와 표(`columns` + `data`/`rows`)도 후보로 잡는다.

export type VizLibrary = "synapse" | "recharts" | "echarts" | "custom";
export type VizKind = "BAR" | "LINE" | "AREA" | "PIE" | "SCATTER" | "KPI" | "TABLE" | "OTHER";

/** 표 컬럼 — 홈은 헤더와 위 몇 줄을 그린다 */
export interface TableColumn {
  field: string;
  header: string;
  /** 앱이 셀을 따로 그린다(배지·서식 등) — 홈은 값을 글자 그대로 보여 준다 */
  custom: boolean;
}

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
  /**
   * 원본 행 → 이 시각화의 값(차트·표는 행 목록, KPI 는 값 하나)을 만드는 레시피 (AOS-6186).
   * 함수 결과를 그대로 넘긴 차트는 null — 홈이 행을 그대로 쓴다.
   */
  recipe: AosRecipe | null;
  /**
   * 사람이 읽는 이름 (AOS-6186) — KPI 의 label/title, 아니면 같은 컴포넌트 안에서 감싼 엘리먼트의 정적 `title`
   * (`<Card title="국가별 브랜드 수">`). 홈이 위젯 안 칸 이름으로 쓴다. 없으면 null
   */
  title: string | null;
  /** 함수별 파라미터 레시피 (`(__in, __lib) => ({…})`). 앱이 파라미터를 넘긴 함수만 있다 */
  parameters: Record<string, string>;
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

/** JSX 속성을 정적 props / 동적 prop 이름 / 값 속성(dataProp)으로 나눈다. 함수 prop(onClick 등)은 버린다 */
function readAttributes(opening: Node, dataProp = "data"): ReadAttrs {
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
    if (name === dataProp) {
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
  let categoryOnY: unknown;
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
    // 가로 막대(`layout="vertical"`)는 범주 축이 YAxis 다
    else if (name === "YAxis" && "dataKey" in attrs) categoryOnY = attrs.dataKey;
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
  if (props.xField === undefined && categoryOnY !== undefined) props.xField = categoryOnY;
  if (kind !== "PIE" && yFields.length > 0) props.yField = yFields.length === 1 ? yFields[0] : yFields;
  if (kind === "AREA") props.area = true;
  return { props, dynamic };
}

// KPI · 표는 값(value / data · rows)과 컬럼만 본다 — 나머지 동적 prop 은 홈이 다시 정하는 표현이다
const VALUE_ONLY_KINDS = new Set<VizKind>(["KPI", "TABLE"]);

type VizBase = Omit<AosVisualization, "reproducible" | "reason" | "recipe" | "parameters" | "title">;

/** 정적 `title` 을 가진 엘리먼트의 범위 — 시각화를 감싼 가장 안쪽 것이 그 이름이다 */
function titledRanges(program: Node): { start: number; end: number; title: string }[] {
  const ranges: { start: number; end: number; title: string }[] = [];
  walk(program, (node) => {
    if (node.type !== "JSXElement") return;
    for (const attr of (node.openingElement as Node).attributes as Node[]) {
      if (attr.type !== "JSXAttribute" || (attr.name as Node).name !== "title") continue;
      const value = attr.value as Node | null;
      const title = value?.type === "JSXExpressionContainer" ? literalString(value.expression as Node) : literalString(value);
      if (title && title.trim()) ranges.push({ start: node.start, end: node.end, title: title.trim() });
    }
  });
  return ranges;
}

function judge(viz: VizBase, recipe: ReturnType<typeof buildRecipe> | null, columnsReason: string | null): { reproducible: boolean; reason: string | null } {
  if (viz.library === "echarts") return { reproducible: false, reason: "echarts option 직접 구성 — 호스트 재현 미지원" };
  if (viz.kind === "OTHER") return { reproducible: false, reason: `${viz.element} 는 아직 선언형 재현 대상이 아님` };
  if (!viz.data) return { reproducible: false, reason: "data 가 OntologyFunction 결과가 아님 (정적 데이터)" };
  if (columnsReason) return { reproducible: false, reason: columnsReason };
  const needsRecipe = !viz.data.direct || viz.data.functions.length !== 1 || viz.kind === "KPI";
  if (needsRecipe && !recipe?.ok) return { reproducible: false, reason: recipe && !recipe.ok ? `가공을 옮길 수 없음: ${recipe.reason}` : "가공을 옮길 수 없음" };
  if (!VALUE_ONLY_KINDS.has(viz.kind)) {
    const blocking = viz.dynamicProps.filter((p) => !PRESENTATION_PROPS.has(p));
    if (blocking.length > 0) return { reproducible: false, reason: `정적으로 읽을 수 없는 prop: ${blocking.join(", ")}` };
  }
  return { reproducible: true, reason: null };
}

function literalString(node: Node | null | undefined): string | null {
  if (!node) return null;
  const value = literalValue(node);
  return typeof value === "string" ? value : null;
}

/** `header: ({ column }) => <DataTableColumnHeader title="이름" />` · `() => <span>이름</span>` 의 글자 */
function headerFromFunction(fn: Node): string | null {
  let found: string | null = null;
  walk(fn, (node) => {
    if (found !== null) return;
    if (node.type === "JSXAttribute" && ["title", "label"].includes((node.name as Node).name as string)) {
      const value = node.value as Node | null;
      found = value?.type === "JSXExpressionContainer" ? literalString(value.expression as Node) : literalString(value);
    } else if (node.type === "JSXText" && ((node.value as string) ?? "").trim()) {
      found = (node.value as string).trim();
    }
  });
  return found;
}

const FIELD_KEYS = ["accessorKey", "key", "dataKey", "field", "dataIndex"];

/** 표의 컬럼 정의 — TanStack ColumnDef(accessorKey · header · cell) 와 `{ key, header, render }` 모양을 읽는다 */
function extractColumns(ctx: RecipeContext, file: string, component: string, expr: Node): TableColumn[] | null {
  const definition = resolveDefinition(ctx, file, component, expr);
  if (!definition || definition.node.type !== "ArrayExpression") return null;
  const columns: TableColumn[] = [];
  for (const element of definition.node.elements as (Node | null)[]) {
    const item = element ? unwrap(element) : null;
    if (!item || item.type !== "ObjectExpression") continue;
    const props = new Map<string, Node>();
    for (const prop of item.properties as Node[]) {
      if (prop.type !== "ObjectProperty" && prop.type !== "ObjectMethod") continue;
      const key = prop.key as Node;
      if (prop.computed) continue;
      props.set((key.name ?? key.value) as string, prop.type === "ObjectMethod" ? prop : (prop.value as Node));
    }
    const field = FIELD_KEYS.map((k) => literalString(props.get(k))).find((v) => v !== null && v !== undefined) ?? null;
    if (!field) continue;
    const headerNode = props.get("header") ?? props.get("title") ?? props.get("label");
    const header =
      literalString(headerNode) ?? (headerNode && isFunctionNode(unwrap(headerNode)) ? headerFromFunction(headerNode) : null) ?? field;
    columns.push({ field, header, custom: props.has("cell") || props.has("render") || props.has("format") });
  }
  return columns.length > 0 ? columns : null;
}

interface Detected {
  library: VizLibrary;
  kind: VizKind;
  element: string;
  /** 값을 받는 prop */
  dataProp: string;
}

/** 속성 값 식 (`title="x"` 면 StringLiteral, `title={x}` 면 그 식) */
function attrValue(opening: Node, name: string): Node | null {
  const attr = (opening.attributes as Node[]).find((a) => a.type === "JSXAttribute" && (a.name as Node).name === name);
  const value = attr?.value as Node | null | undefined;
  if (!value) return null;
  return value.type === "JSXExpressionContainer" ? (value.expression as Node) : value;
}

function attrNames(opening: Node): Set<string> {
  const names = new Set<string>();
  for (const attr of opening.attributes as Node[]) {
    if (attr.type === "JSXAttribute" && (attr.name as Node).type === "JSXIdentifier") names.add((attr.name as Node).name as string);
  }
  return names;
}

function detect(opening: Node, imports: Map<string, ImportInfo>): Detected | null {
  const local = jsxElementName(opening);
  const info = imports.get(local);
  if (info) {
    if (SYNAPSE_CHART_MODULES.has(info.module) && info.imported in SYNAPSE_KINDS) {
      const kind = SYNAPSE_KINDS[info.imported];
      return { library: "synapse", kind, element: info.imported, dataProp: kind === "KPI" ? "value" : "data" };
    }
    if (info.module === RECHARTS_MODULE && info.imported in RECHARTS_CONTAINERS) {
      return { library: "recharts", kind: RECHARTS_CONTAINERS[info.imported], element: info.imported, dataProp: "data" };
    }
    if (ECHARTS_MODULES.has(info.module)) return { library: "echarts", kind: "OTHER", element: info.imported, dataProp: "data" };
    if (info.module === RECHARTS_MODULE || ECHARTS_MODULES.has(info.module)) return null;
  }
  if (!local || !isPascalCase(local)) return null;
  const names = attrNames(opening);
  const element = info && info.imported !== "default" ? info.imported : local;
  const library: VizLibrary = info && DATA_TABLE_MODULES.has(info.module) ? "synapse" : "custom";
  if (names.has("columns") && (names.has("data") || names.has("rows"))) {
    return { library, kind: "TABLE", element, dataProp: names.has("data") ? "data" : "rows" };
  }
  if (names.has("value") && (names.has("label") || names.has("title"))) {
    return { library: "custom", kind: "KPI", element, dataProp: "value" };
  }
  return null;
}

const DATA_TABLE_MODULES = new Set(["@enhans/synapse/data-table"]);

/** 컴포넌트 이름 → 그 컴포넌트 안의 시각화 목록. ctx 가 없으면 레시피·컬럼을 만들지 않는다 */
export function extractVisualizations(
  ast: Node,
  file: string,
  flow: DataflowResult,
  ctx: RecipeContext | null = null,
): Map<string, AosVisualization[]> {
  const program = (ast.type === "File" ? ast.program : ast) as Node;
  const imports = collectImports(program);
  const byComponent = new Map<string, AosVisualization[]>();
  const owner = (pos: number) => flow.components.find((c) => c.start <= pos && pos < c.end) ?? null;
  const toIds = (keys: string[]) => keys.map((k) => flow.functionIds.get(k)).filter((id): id is string => !!id);
  const titles = titledRanges(program);

  walk(program, (node) => {
    if (node.type !== "JSXElement") return;
    const opening = node.openingElement as Node;
    const detected = detect(opening, imports);
    if (!detected) return;
    const { library, kind, element, dataProp } = detected;

    const comp = owner(node.start);
    if (!comp) return;
    const { props, dynamic, dataAttr } = readAttributes(opening, dataProp);
    // 함수 데이터가 들어가지 않는 카드·표(정적 안내 카드 등)는 후보가 아니다 — 차트는 예전처럼 남긴다
    const dataLoc = dataAttr ? locOf(file, dataAttr) : null;
    const binding = dataLoc ? comp.bindings.find((b) => b.loc === dataLoc && b.prop === dataProp) : undefined;
    if (VALUE_ONLY_KINDS.has(kind) && !binding) return;

    let specProps = props;
    const dynamicProps = [...dynamic];
    if (library === "recharts") {
      const normalized = normalizeRecharts(node, kind, imports);
      specProps = normalized.props;
      dynamicProps.push(...normalized.dynamic);
    }

    let columnsReason: string | null = null;
    if (kind === "TABLE") {
      const columnsAttr = (opening.attributes as Node[]).find(
        (a) => a.type === "JSXAttribute" && (a.name as Node).name === "columns",
      );
      const expression = (columnsAttr?.value as Node | null)?.type === "JSXExpressionContainer" ? ((columnsAttr!.value as Node).expression as Node) : null;
      const columns = ctx && expression ? extractColumns(ctx, file, comp.name, expression) : null;
      if (columns) specProps = { ...specProps, columns };
      else columnsReason = "컬럼 정의를 정적으로 읽을 수 없음";
      delete specProps.rows;
    }

    const expression =
      dataAttr && (dataAttr.value as Node | null)?.type === "JSXExpressionContainer"
        ? ((dataAttr.value as Node).expression as Node)
        : null;
    const recipe = ctx && binding && expression ? buildRecipe(ctx, file, comp.name, expression) : null;

    const base: VizBase = {
      library,
      element,
      kind,
      loc: locOf(file, opening),
      spec: { component: element, props: specProps },
      data: binding ? { functions: toIds(binding.functionKeys), direct: binding.direct } : null,
      dynamicProps: [...new Set(dynamicProps)],
    };
    const verdict = judge(base, recipe, columnsReason);
    const needsRecipe = !!base.data && (!base.data.direct || base.data.functions.length !== 1 || kind === "KPI");
    const label = kind === "KPI" ? (literalString(attrValue(opening, "label")) ?? literalString(attrValue(opening, "title"))) : null;
    const enclosing = titles
      .filter((t) => t.start <= node.start && node.end <= t.end && comp.start <= t.start)
      .sort((a, b) => b.start - a.start)[0];
    const list = byComponent.get(comp.name) ?? [];
    list.push({
      ...base,
      title: label ?? enclosing?.title ?? null,
      recipe: verdict.reproducible && needsRecipe && recipe?.ok ? recipe.recipe : null,
      parameters: recipe?.ok ? recipe.parameters : {},
      ...verdict,
    });
    byComponent.set(comp.name, list);
  });

  return byComponent;
}
