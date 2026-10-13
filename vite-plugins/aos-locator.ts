import path from "path";
import { parse } from "@babel/parser";
import MagicString from "magic-string";
import type { Plugin, ResolvedConfig } from "vite";
import { childNodes, isPascalCase, locOf, type Node, walk } from "./aos-ast";
import { analyzeDataflow, type DataflowViolation } from "./aos-dataflow";
import { type AosVisualization, extractVisualizations } from "./aos-viz";

// 앱빌더 요소 식별 플러그인 (AOS-4173).
//
// 소스를 모듈 단위 transform 시점에 한 번 파싱해서 두 가지를 만든다. 원본 tsx 는 건드리지 않는다.
//
//  - dev(serve): JSX 엘리먼트에 `data-aos-loc="src/App.tsx:120:8"` 소스 좌표를 주입한다.
//    미리보기에서 클릭한 DOM 이 어느 JSX 인지 바로 역추적하기 위함. 좌표는 수정 한 턴 동안만
//    유효하다 — 앱빌더는 보통 App.tsx 를 통째로 다시 쓰므로 줄·칼럼이 전부 밀린다. 저장하지 말 것.
//  - build: `data-aos-id` 가 붙은 컴포넌트 목록을 `aos-manifest.json` 으로 dist 에 내보낸다.
//    배포 번들에는 좌표 속성을 넣지 않는다 (최종 사용자에게 노출되고 번들만 커진다).
//
// 주입 대상은 두 부류로 제한한다.
//  1) 소문자 host 엘리먼트 (`div`, `section` ...) — React 가 속성을 그대로 DOM 에 내린다.
//  2) 이미 `data-aos-id` 가 붙은 엘리먼트 — 그 속성이 DOM 까지 전달된다는 게 증명된 컴포넌트다.
// 그 외 컴포넌트는 rest props 를 DOM 에 내리지 않으면 속성이 조용히 사라지고, Fragment 는 React
// 경고를 낸다. 그래서 주입하지 않는다.
//
// data-aos-functions (AOS-4888-a): LLM 이 쓰지 않은 컴포넌트에는 aos-dataflow 가 계산한 값을
// dev·build 양쪽에 주입한다 (배포 DOM 도 인스펙트·위젯이 읽는다). LLM 이 이미 쓴 값은 덮어쓰지 않고,
// 매니페스트에 두 값을 함께 남겨 추적 결과와 비교할 수 있게 한다.
//
// data-aos-k (AOS-5814): 좌표를 해시한 짧은 키 `k1x9f3a`. loc 과 같은 대상에 dev·build 양쪽으로 넣는다.
// 배포 DOM 에서 "고른 영역이 어느 차트를 담고 있나" 를 매니페스트와 맞추는 용도다 — 파일 경로·줄 번호는
// 드러나지 않는다. 매니페스트 최상위 visualizations[].anchors 가 이 키로 차트를 감싼 DOM 을 가리킨다.
//
// plugin-react 의 babel 옵션 안이 아니라 `enforce: "pre"` 독립 플러그인으로 둔다. 뒤에 오는 JSX
// 변환기(Babel / Oxc)가 바뀌어도 이 플러그인은 그대로 동작한다 (Vite 8 + plugin-react 6 대비).

export const AOS_MANIFEST_FILE = "aos-manifest.json";
// v2 (AOS-4888-a): functionsSource / functionsInferred / component / bindings / files 추가.
// v3 (AOS-4929): visualizations 추가. 이전 필드는 그대로라 이전 소비자도 읽을 수 있다.
// v4 (AOS-5814): components[].key, 최상위 visualizations(key · component · anchors) 추가.
export const AOS_MANIFEST_VERSION = 4;

export interface AosComponent {
  /** data-aos-id 값 */
  id: string;
  /** data-aos-name 값 (없으면 null — 호스트가 id 에서 PascalCase 로 유도한다) */
  name: string | null;
  /** JSX 엘리먼트 이름 (`Card`, `KpiCard`, `section` ...) */
  element: string;
  /** 이 컴포넌트가 쓰는 OntologyFunction id 목록 (explicit 이 있으면 그것, 없으면 inferred) */
  functions: string[];
  /** functions 의 출처 — LLM 이 쓴 값인지, 데이터 흐름 추적 값인지 */
  functionsSource: "explicit" | "inferred" | "none";
  /** 데이터 흐름 추적이 계산한 값 (explicit 과 달라도 그대로 남긴다) */
  functionsInferred: string[];
  /** data-aos-id 엘리먼트를 감싼 top-level 컴포넌트 이름 (top-level 밖이면 null) */
  component: string | null;
  /** 이 컴포넌트 안에서 함수 데이터가 흘러 들어가는 JSX 속성 (차트 data 등) */
  bindings: AosBinding[];
  /** 이 컴포넌트 안의 차트 명세 — 위젯이 복사해 저장한다 (AOS-4929) */
  visualizations: AosVisualization[];
  /** 정적 문자열이 아니라 해석하지 못한 data-aos-functions 표현식 원문 (없으면 null) */
  functionsExpression: string | null;
  /** `src/App.tsx:120:8` — 라인 1-based, 칼럼 1-based */
  loc: string;
  /** DOM 의 data-aos-k 값 */
  key: string;
}

/**
 * 앱 전체의 차트 하나 (data-aos-id 유무와 무관). 위젯은 선택한 DOM subtree 의 data-aos-k 와 anchors 가
 * 하나라도 겹치는 차트를 "그 영역 안의 차트" 로 본다.
 */
export interface AosManifestVisualization extends AosVisualization {
  /** 차트 JSX 좌표의 해시 — 위젯이 차트를 가리키는 식별자 */
  key: string;
  /** 차트를 감싼 top-level 컴포넌트 이름 */
  component: string;
  /**
   * 차트를 감싼 가장 가까운 키 보유 DOM(host 또는 data-aos-id 엘리먼트)의 키. 컴포넌트의 루트가 차트라
   * 같은 파일에 감싼 DOM 이 없으면 그 컴포넌트를 쓰는 자리를 따라 올라가 모은다.
   */
  anchors: string[];
}

/** 파일 하나에서 뽑은 차트 — anchors 는 파일을 모두 모은 뒤 buildManifest 가 해석한다 */
export interface AosVizRecord extends AosVisualization {
  component: string;
  /** 같은 파일 안에서 감싼 키 보유 엘리먼트의 loc (없으면 null — 컴포넌트 사용처로 해석) */
  anchorLoc: string | null;
}

/** `<Name ...>` 사용처 — 컴포넌트 경계를 넘어 anchors 를 해석할 때 쓴다 */
export interface AosUsage {
  name: string;
  anchorLoc: string | null;
  /** 사용처를 감싼 top-level 컴포넌트 (top-level 밖이면 null) */
  owner: string | null;
}

export interface AosBinding {
  element: string;
  prop: string;
  loc: string;
  /** OntologyFunction id */
  functions: string[];
  /** hook 결과 data 를 변환 없이 그대로 받는가 */
  direct: boolean;
}

export interface AosFileReport {
  file: string;
  /** useOntologyFunction 을 한 번이라도 쓰는가 — false 면 기존(Promise.all) 패턴 파일 */
  usesHook: boolean;
  violations: DataflowViolation[];
}

export interface AosManifest {
  version: number;
  components: AosComponent[];
  /** 두 번 이상 선언된 data-aos-id — 클릭 대상이 모호해진다 */
  duplicateIds: string[];
  /** 데이터 흐름 추적 계약(useOntologyFunction)을 벗어난 위치 — 파일별 */
  files: AosFileReport[];
  /** 앱 전체의 차트 (AOS-5814) */
  visualizations: AosManifestVisualization[];
}

export interface AnalyzeResult {
  /** 주입이 일어났을 때만 값이 있다 */
  code: string | null;
  map: ReturnType<MagicString["generateMap"]> | null;
  components: AosComponent[];
  file: AosFileReport;
  visualizations: AosVizRecord[];
  usages: AosUsage[];
}

const AOS_ID = "data-aos-id";
const AOS_NAME = "data-aos-name";
const AOS_FUNCTIONS = "data-aos-functions";
const AOS_LOC = "data-aos-loc";
const AOS_KEY = "data-aos-k";

/** loc → `k` + base36(FNV-1a 32bit). 빌드마다 같은 소스면 같은 키다 */
export function aosKey(loc: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < loc.length; i++) {
    hash ^= loc.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `k${(hash >>> 0).toString(36)}`;
}

function jsxName(name: Node): string {
  switch (name.type) {
    case "JSXIdentifier":
      return name.name as string;
    case "JSXMemberExpression":
      return `${jsxName(name.object as Node)}.${jsxName(name.property as Node)}`;
    case "JSXNamespacedName":
      return `${jsxName(name.namespace as Node)}:${jsxName(name.name as Node)}`;
    default:
      return "";
  }
}

function isHostElement(name: Node): boolean {
  if (name.type !== "JSXIdentifier") return false;
  const first = (name.name as string).charAt(0);
  return first >= "a" && first <= "z";
}

function isFragment(elementName: string): boolean {
  return elementName === "Fragment" || elementName.endsWith(".Fragment");
}

/** 속성 값이 정적 문자열이면 그 값을, 아니면 null 을 돌려준다. */
function staticString(value: Node | null | undefined): string | null {
  if (!value) return null;
  if (value.type === "StringLiteral") return value.value as string;
  if (value.type === "JSXExpressionContainer") {
    const expr = value.expression as Node;
    if (expr.type === "StringLiteral") return expr.value as string;
    if (expr.type === "TemplateLiteral" && (expr.expressions as Node[]).length === 0) {
      const quasis = expr.quasis as Node[];
      return (quasis[0].value as { cooked: string }).cooked;
    }
  }
  return null;
}

function splitFunctions(raw: string): string[] {
  return raw
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function hasAttr(opening: Node, name: string): boolean {
  return (opening.attributes as Node[]).some(
    (a) => a.type === "JSXAttribute" && (a.name as Node).type === "JSXIdentifier" && (a.name as Node).name === name,
  );
}

/** 키(data-aos-k)가 DOM 까지 내려가는 엘리먼트 — loc 주입 대상과 같다 */
function isKeyed(opening: Node): boolean {
  return isHostElement(opening.name as Node) || hasAttr(opening, AOS_ID);
}

/**
 * JSX 트리를 한 번 내려가며 엘리먼트마다 "가장 가까운 키 보유 조상" 을 기록한다. 조건부·map 콜백 안의
 * JSX 도 바깥 JSX 의 자식으로 본다. 변수에 담았다가 렌더하는 JSX 는 조상이 없다(null) — 그 경우는 컴포넌트
 * 사용처로 넘어간다.
 */
function scanJsxAncestors(program: Node, file: string): { anchorOf: Map<string, string | null>; usages: { name: string; anchorLoc: string | null; pos: number }[] } {
  const anchorOf = new Map<string, string | null>();
  const usages: { name: string; anchorLoc: string | null; pos: number }[] = [];
  const visit = (node: Node, nearest: string | null) => {
    let next = nearest;
    if (node.type === "JSXElement") {
      const opening = node.openingElement as Node;
      const nameNode = opening.name as Node;
      const element = jsxName(nameNode);
      if (element && !isFragment(element)) {
        const loc = locOf(file, opening);
        anchorOf.set(loc, isKeyed(opening) ? loc : nearest);
        if (nameNode.type === "JSXIdentifier" && isPascalCase(element)) {
          usages.push({ name: element, anchorLoc: nearest, pos: node.start });
        }
        if (isKeyed(opening)) next = loc;
      }
    }
    for (const child of childNodes(node)) visit(child, next);
  };
  visit(program, null);
  return { anchorOf, usages };
}

/**
 * 모듈 하나를 파싱해 컴포넌트 목록을 뽑고, `injectLoc` 이면 좌표 속성을 주입한 코드를 돌려준다.
 * 파싱 실패는 예외로 올리지 않는다 — 식별자는 부가 기능이라 문법 오류 보고는 뒤의 변환기에 맡긴다.
 */
export function analyzeAosSource(code: string, file: string, options: { injectLoc: boolean }): AnalyzeResult {
  let ast: Node;
  try {
    ast = parse(code, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
      errorRecovery: true,
    }) as unknown as Node;
  } catch {
    return {
      code: null,
      map: null,
      components: [],
      file: { file, usesHook: false, violations: [] },
      visualizations: [],
      usages: [],
    };
  }

  const s = new MagicString(code);
  const components: AosComponent[] = [];
  let injected = false;

  const flow = analyzeDataflow(ast, file);
  const visualizations = extractVisualizations(ast, file, flow);
  const toIds = (keys: string[]) => keys.map((k) => flow.functionIds.get(k)).filter((id): id is string => !!id);
  const enclosing = (pos: number) => flow.components.find((c) => c.start <= pos && pos < c.end) ?? null;
  const program = (ast.type === "File" ? ast.program : ast) as Node;
  const { anchorOf, usages: rawUsages } = scanJsxAncestors(program, file);
  const vizRecords: AosVizRecord[] = [...visualizations.entries()].flatMap(([component, list]) =>
    list.map((viz) => ({ ...viz, component, anchorLoc: anchorOf.get(viz.loc) ?? null })),
  );
  const usages: AosUsage[] = rawUsages.map((u) => ({
    name: u.name,
    anchorLoc: u.anchorLoc,
    owner: enclosing(u.pos)?.name ?? null,
  }));

  walk(ast, (node) => {
    if (node.type !== "JSXOpeningElement") return;

    const nameNode = node.name as Node;
    const element = jsxName(nameNode);
    if (!element || isFragment(element)) return;

    const attrs = new Map<string, Node>();
    for (const attr of node.attributes as Node[]) {
      if (attr.type !== "JSXAttribute") continue;
      const attrName = attr.name as Node;
      if (attrName.type === "JSXIdentifier") attrs.set(attrName.name as string, attr);
    }

    const { line, column } = nameNode.loc.start;
    // `<` 의 1-based 칼럼. babel 칼럼은 0-based 이고 이름은 `<` 바로 뒤에 오므로 이름의 칼럼과 같다.
    const loc = `${file}:${line}:${column}`;

    // 제네릭 컴포넌트(`<Select<Option> ...>`)면 타입 인자 뒤에 넣어야 문법이 유지된다.
    const typeArgs = (node.typeArguments ?? node.typeParameters) as Node | undefined;
    const insertAt = typeArgs ? typeArgs.end : nameNode.end;

    const idAttr = attrs.get(AOS_ID);
    const id = staticString(idAttr?.value as Node | undefined);
    if (id !== null) {
      const fnAttr = attrs.get(AOS_FUNCTIONS);
      const fnValue = fnAttr?.value as Node | undefined;
      const fnRaw = staticString(fnValue);
      const owner = enclosing(node.start);
      const inferred = owner ? toIds(owner.functionKeys) : [];
      const explicit = fnRaw === null ? [] : splitFunctions(fnRaw);
      const source = fnAttr ? "explicit" : inferred.length > 0 ? "inferred" : "none";

      // LLM 이 쓰지 않았을 때만 추적값을 넣는다 (기존 앱이 쓴 값은 그대로 둔다)
      if (!fnAttr && inferred.length > 0) {
        s.appendLeft(insertAt, ` ${AOS_FUNCTIONS}="${inferred.join(",")}"`);
        injected = true;
      }

      components.push({
        id,
        name: staticString(attrs.get(AOS_NAME)?.value as Node | undefined),
        element,
        functions: source === "explicit" ? explicit : inferred,
        functionsSource: source,
        functionsInferred: inferred,
        component: owner?.name ?? null,
        bindings: (owner?.bindings ?? []).map((b) => ({
          element: b.element,
          prop: b.prop,
          loc: b.loc,
          functions: toIds(b.functionKeys),
          direct: b.direct,
        })),
        visualizations: owner ? (visualizations.get(owner.name) ?? []) : [],
        functionsExpression: fnValue && fnRaw === null ? code.slice(fnValue.start, fnValue.end) : null,
        loc,
        key: aosKey(loc),
      });
    }

    if (!isHostElement(nameNode) && !idAttr) return;

    if (!attrs.has(AOS_KEY)) {
      s.appendLeft(insertAt, ` ${AOS_KEY}="${aosKey(loc)}"`);
      injected = true;
    }
    if (options.injectLoc && !attrs.has(AOS_LOC)) {
      s.appendLeft(insertAt, ` ${AOS_LOC}="${loc}"`);
      injected = true;
    }
  });

  const fileReport: AosFileReport = { file, usesHook: flow.usesHook, violations: flow.violations };
  const base = { components, file: fileReport, visualizations: vizRecords, usages };
  if (!injected) return { code: null, map: null, ...base };
  return {
    code: s.toString(),
    // source 는 비워 둔다 — Vite 가 transform 체인의 map 을 합칠 때 모듈 id 로 채운다.
    map: s.generateMap({ hires: "boundary" }),
    ...base,
  };
}

/**
 * 차트의 anchors 를 컴포넌트 경계를 넘어 해석한다. 같은 파일에 감싼 키 보유 DOM 이 있으면 그것 하나,
 * 없으면(컴포넌트 루트가 차트) 그 컴포넌트를 쓰는 모든 자리의 감싼 DOM 을 모은다 — 사용처도 루트라면 한 단계 더.
 */
function resolveAnchors(viz: AosVizRecord, usages: AosUsage[]): string[] {
  if (viz.anchorLoc) return [aosKey(viz.anchorLoc)];
  const keys = new Set<string>();
  const visited = new Set<string>();
  const fromComponent = (name: string) => {
    if (visited.has(name)) return;
    visited.add(name);
    for (const usage of usages) {
      if (usage.name !== name) continue;
      if (usage.anchorLoc) keys.add(aosKey(usage.anchorLoc));
      else if (usage.owner) fromComponent(usage.owner);
    }
  };
  fromComponent(viz.component);
  return [...keys].sort();
}

export function buildManifest(
  components: AosComponent[],
  files: AosFileReport[] = [],
  visualizations: AosVizRecord[] = [],
  usages: AosUsage[] = [],
): AosManifest {
  const sorted = [...components].sort((a, b) => a.loc.localeCompare(b.loc, "en", { numeric: true }));
  const counts = new Map<string, number>();
  for (const c of sorted) counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
  const duplicateIds = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort();
  // 데이터 조회와 무관한 파일(유틸·main.tsx)은 싣지 않는다
  const relevant = files
    .filter((f) => f.usesHook || f.violations.length > 0)
    .sort((a, b) => a.file.localeCompare(b.file));
  const vizList: AosManifestVisualization[] = [...visualizations]
    .sort((a, b) => a.loc.localeCompare(b.loc, "en", { numeric: true }))
    .map((record) => {
      const { anchorLoc: _anchorLoc, ...viz } = record;
      return { ...viz, key: aosKey(viz.loc), anchors: resolveAnchors(record, usages) };
    });
  return { version: AOS_MANIFEST_VERSION, components: sorted, duplicateIds, files: relevant, visualizations: vizList };
}

const TARGET_EXT = /\.[jt]sx$/;
const EXCLUDED = /(\/node_modules\/|\/src\/test\/|\.(test|spec)\.[jt]sx$)/;

export function aosLocator(): Plugin {
  let config: ResolvedConfig;
  // build 는 모듈마다 transform 이 한 번 돈다. 파일 단위로 덮어써 재변환에도 중복이 생기지 않게 한다.
  const componentsByFile = new Map<string, AosComponent[]>();
  const reportsByFile = new Map<string, AosFileReport>();
  const vizByFile = new Map<string, AosVizRecord[]>();
  const usagesByFile = new Map<string, AosUsage[]>();

  return {
    name: "aos-locator",
    enforce: "pre",
    configResolved(resolved) {
      config = resolved;
    },
    buildStart() {
      componentsByFile.clear();
      reportsByFile.clear();
      vizByFile.clear();
      usagesByFile.clear();
    },
    transform(code, id) {
      const file = id.split("?", 1)[0];
      if (!TARGET_EXT.test(file) || EXCLUDED.test(file)) return null;
      const srcRoot = path.join(config.root, "src") + path.sep;
      if (!file.startsWith(srcRoot)) return null;

      const relative = path.relative(config.root, file).split(path.sep).join("/");
      const isServe = config.command === "serve";
      const result = analyzeAosSource(code, relative, { injectLoc: isServe });

      if (!isServe) {
        componentsByFile.set(relative, result.components);
        reportsByFile.set(relative, result.file);
        vizByFile.set(relative, result.visualizations);
        usagesByFile.set(relative, result.usages);
      }
      if (result.code === null) return null;
      return { code: result.code, map: result.map };
    },
    generateBundle() {
      const manifest = buildManifest(
        [...componentsByFile.values()].flat(),
        [...reportsByFile.values()],
        [...vizByFile.values()].flat(),
        [...usagesByFile.values()].flat(),
      );
      this.emitFile({
        type: "asset",
        fileName: AOS_MANIFEST_FILE,
        source: JSON.stringify(manifest, null, 2),
      });
    },
  };
}
