import fs from "fs";
import path from "path";
import MagicString from "magic-string";
import type { ModuleNode, Plugin, ResolvedConfig, ViteDevServer } from "vite";
import { childNodes, isPascalCase, locOf, type Node, walk } from "./aos-ast";
import { analyzeProjectDataflow, type DataflowViolation, type ProjectFlow } from "./aos-dataflow";
import { AosProject, findCycles, isIndexable } from "./aos-project";
import { RecipeContext, singleFileSources } from "./aos-recipe";
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
//
// 멀티모듈 (AOS-4902): 데이터 흐름·차트·anchors 는 파일 하나가 아니라 src/ 전체를 본다 (aos-project).
// App.tsx 가 조회한 데이터를 src/modules/X.tsx 에 props 로 넘겨도 X 의 data-aos-functions 가 잡힌다.
// 그래서 dev 에서는 한 파일이 바뀌면 **다른 파일**의 주입값이 달라질 수 있다 — handleHotUpdate 가 그런
// 모듈을 찾아 무효화하고 HMR 대상에 함께 싣는다.

export const AOS_MANIFEST_FILE = "aos-manifest.json";
// v2 (AOS-4888-a): functionsSource / functionsInferred / component / bindings / files 추가.
// v3 (AOS-4929): visualizations 추가. 이전 필드는 그대로라 이전 소비자도 읽을 수 있다.
// v4 (AOS-5814): components[].key, 최상위 visualizations(key · component · anchors) 추가.
// v5 (AOS-6186): visualizations[].recipe(가공 레시피) · parameters(함수 파라미터 레시피) · title, kind TABLE · KPI
//   (앱이 만든 카드 포함), 표의 spec.props.columns. 가공된 값도 레시피를 옮길 수 있으면 reproducible 이다.
// v6 (AOS-4902): components[].file, 최상위 modules(파일별 실행 시점 import) · cycles(순환 import) 추가.
//   추적이 파일 경계를 넘는다 — 다른 파일에서 props 로 받은 데이터도 functions / visualizations.data 에 잡힌다.
export const AOS_MANIFEST_VERSION = 6;

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
  /** data-aos-id 가 적힌 파일 (프로젝트 루트 기준, `src/modules/SalesChart.tsx`) */
  file: string;
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
  /** `파일#이름` — 다른 파일의 같은 이름 컴포넌트와 구분한다 (없으면 이름으로만 맞춘다) */
  componentId?: string;
  /** 같은 파일 안에서 감싼 키 보유 엘리먼트의 loc (없으면 null — 컴포넌트 사용처로 해석) */
  anchorLoc: string | null;
}

/** `<Name ...>` 사용처 — 컴포넌트 경계를 넘어 anchors 를 해석할 때 쓴다 */
export interface AosUsage {
  name: string;
  anchorLoc: string | null;
  /** 사용처를 감싼 top-level 컴포넌트 (top-level 밖이면 null) */
  owner: string | null;
  /** import 를 따라 해석한 대상 컴포넌트 `파일#이름` (해석 못 하면 null — 이름으로 맞춘다) */
  target?: string | null;
  /** owner 의 `파일#이름` */
  ownerId?: string | null;
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

/** 빌드에 들어간 모듈 하나의 실행 시점 import (AOS-4902) */
export interface AosModule {
  file: string;
  /** 해석된 프로젝트 파일 — `import type` · type 전용 지정자는 뺀다 */
  imports: string[];
  /** `@/` · 상대 경로인데 프로젝트 파일로 해석되지 않은 지정자 (없는 파일 import) */
  unresolved: string[];
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
  /** 모듈별 import (AOS-4902) */
  modules: AosModule[];
  /** 순환 import — 각 원소는 서로를 (간접적으로) import 하는 파일들 */
  cycles: string[][];
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
 *
 * `project` 를 주면 데이터 흐름을 프로젝트 전체로 계산한다 (이 파일의 내용은 code 로 갱신한다).
 * 없으면 이 파일 하나만 있는 프로젝트로 본다 — 다른 파일에서 오는 props 는 모른다.
 */
export function analyzeAosSource(
  code: string,
  file: string,
  options: { injectLoc: boolean; project?: AosProject },
): AnalyzeResult {
  const project = options.project ?? new AosProject();
  project.set(file, code);
  const program = project.module(file)?.program ?? null;
  if (!program) {
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

  const projectFlow = analyzeProjectDataflow(project);
  const flow = projectFlow.files.get(file)!;
  // 레시피는 아직 이 파일 안에서 따라간다 — 파일을 넘는 추적은 프로젝트 소스로 바꿔 끼운다
  const recipes = new RecipeContext(singleFileSources(file, program, code, flow));
  const visualizations = extractVisualizations(program, file, flow, recipes);
  const enclosing = (pos: number) => flow.components.find((c) => c.start <= pos && pos < c.end) ?? null;
  const { anchorOf, usages: rawUsages } = scanJsxAncestors(program, file);
  const vizRecords: AosVizRecord[] = [...visualizations.entries()].flatMap(([component, list]) =>
    list.map((viz) => ({ ...viz, component, componentId: `${file}#${component}`, anchorLoc: anchorOf.get(viz.loc) ?? null })),
  );
  const usages: AosUsage[] = rawUsages.map((u) => {
    const owner = enclosing(u.pos);
    return {
      name: u.name,
      anchorLoc: u.anchorLoc,
      owner: owner?.name ?? null,
      target: projectFlow.resolveElement(file, u.name),
      ownerId: owner?.id ?? null,
    };
  });

  walk(program, (node) => {
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
      const inferred = owner ? owner.functionIds : [];
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
          functions: b.functionIds,
          direct: b.direct,
        })),
        visualizations: owner ? (visualizations.get(owner.name) ?? []) : [],
        functionsExpression: fnValue && fnRaw === null ? code.slice(fnValue.start, fnValue.end) : null,
        loc,
        key: aosKey(loc),
        file,
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
  // 사용처가 import 를 따라 해석됐으면 `파일#이름` 으로, 아니면 이름으로 맞춘다 — 다른 파일의 같은 이름
  // 컴포넌트나 별칭 import(`import { A as B }`)가 섞이지 않게
  const usedHere = (usage: AosUsage, id: string | null, name: string) =>
    usage.target && id ? usage.target === id : usage.name === name;
  const fromComponent = (id: string | null, name: string) => {
    const visitKey = id ?? name;
    if (visited.has(visitKey)) return;
    visited.add(visitKey);
    for (const usage of usages) {
      if (!usedHere(usage, id, name)) continue;
      if (usage.anchorLoc) keys.add(aosKey(usage.anchorLoc));
      else if (usage.owner) fromComponent(usage.ownerId ?? null, usage.owner);
    }
  };
  fromComponent(viz.componentId ?? null, viz.component);
  return [...keys].sort();
}

export function buildManifest(
  components: AosComponent[],
  files: AosFileReport[] = [],
  visualizations: AosVizRecord[] = [],
  usages: AosUsage[] = [],
  modules: AosModule[] = [],
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
      const { anchorLoc: _anchorLoc, componentId: _componentId, ...viz } = record;
      return { ...viz, key: aosKey(viz.loc), anchors: resolveAnchors(record, usages) };
    });
  const sortedModules = [...modules].sort((a, b) => a.file.localeCompare(b.file));
  const cycles = findCycles(new Map(sortedModules.map((m) => [m.file, m.imports])));
  return {
    version: AOS_MANIFEST_VERSION,
    components: sorted,
    duplicateIds,
    files: relevant,
    visualizations: vizList,
    modules: sortedModules,
    cycles,
  };
}

/** 프로젝트의 모듈 import 표 — files 를 주면 그 파일만 (build 에 실제로 들어간 모듈) */
export function projectModules(project: AosProject, files: Iterable<string> = project.files()): AosModule[] {
  return [...files]
    .filter((file) => project.has(file))
    .sort()
    .map((file) => ({ file, imports: project.runtimeImports(file), unresolved: project.unresolvedImports(file) }));
}

/**
 * 프로젝트 전체를 한 번에 분석해 매니페스트를 만든다 — build 의 transform → generateBundle 과 같은 결과다.
 * 테스트와 오프라인 점검용 (플러그인은 transform 마다 파일 하나씩 돈다).
 */
export function analyzeProject(project: AosProject, options: { injectLoc: boolean }): { results: Map<string, AnalyzeResult>; manifest: AosManifest } {
  const results = new Map<string, AnalyzeResult>();
  for (const file of project.files()) {
    if (!TARGET_EXT.test(file)) continue;
    results.set(file, analyzeAosSource(project.sourceOf(file) ?? "", file, { ...options, project }));
  }
  const flows = analyzeProjectDataflow(project);
  const all = [...results.values()];
  const manifest = buildManifest(
    all.flatMap((r) => r.components),
    project.files().flatMap((file) => fileReport(flows, file)),
    all.flatMap((r) => r.visualizations),
    all.flatMap((r) => r.usages),
    projectModules(project),
  );
  return { results, manifest };
}

function fileReport(flows: ProjectFlow, file: string): AosFileReport[] {
  const flow = flows.files.get(file);
  return flow ? [{ file, usesHook: flow.usesHook, violations: flow.violations }] : [];
}

/**
 * 파일마다 "다른 파일에 따라 달라지는 주입값" 의 서명 — 컴포넌트별 추적 UUID.
 * 한 파일이 바뀐 뒤 서명이 달라진 **다른** 파일은 transform 결과(data-aos-functions)가 낡았다.
 */
export function fileSignatures(flows: ProjectFlow): Map<string, string> {
  const signatures = new Map<string, string>();
  for (const [file, flow] of flows.files) {
    signatures.set(file, JSON.stringify(flow.components.map((c) => [c.name, c.functionIds])));
  }
  return signatures;
}

/** before/after 서명이 다른 파일 중 changed 자신을 뺀 것 (정렬) */
export function staleFiles(before: Map<string, string>, after: Map<string, string>, changed: string): string[] {
  const files = new Set([...before.keys(), ...after.keys()]);
  return [...files].filter((file) => file !== changed && before.get(file) !== after.get(file)).sort();
}

const TARGET_EXT = /\.[jt]sx$/;

export function aosLocator(): Plugin {
  let config: ResolvedConfig;
  let project: AosProject | null = null;
  // build 는 모듈마다 transform 이 한 번 돈다. 파일 단위로 덮어써 재변환에도 중복이 생기지 않게 한다.
  const componentsByFile = new Map<string, AosComponent[]>();
  const vizByFile = new Map<string, AosVizRecord[]>();
  const usagesByFile = new Map<string, AosUsage[]>();
  // build 에 실제로 들어간 소스 모듈 (.ts 포함) — 매니페스트 files / modules 의 범위
  const builtFiles = new Set<string>();

  const relativeOf = (absolute: string): string | null => {
    const file = absolute.split("?", 1)[0];
    const srcRoot = path.join(config.root, "src") + path.sep;
    if (!file.startsWith(srcRoot)) return null;
    const relative = path.relative(config.root, file).split(path.sep).join("/");
    return isIndexable(relative) ? relative : null;
  };
  const ensureProject = (): AosProject => (project ??= AosProject.fromDisk(config.root));

  /** 파일 하나를 갱신하고, 그 때문에 주입값이 달라진 다른 파일의 모듈을 무효화해 돌려준다 */
  const syncFile = (server: ViteDevServer, relative: string, update: (p: AosProject) => boolean): ModuleNode[] => {
    const current = ensureProject();
    const before = fileSignatures(analyzeProjectDataflow(current));
    if (!update(current)) return [];
    const after = fileSignatures(analyzeProjectDataflow(current));
    const stale: ModuleNode[] = [];
    for (const file of staleFiles(before, after, relative)) {
      for (const mod of server.moduleGraph.getModulesByFile(path.join(config.root, file)) ?? []) {
        server.moduleGraph.invalidateModule(mod);
        stale.push(mod);
      }
    }
    return stale;
  };

  return {
    name: "aos-locator",
    enforce: "pre",
    configResolved(resolved) {
      config = resolved;
    },
    buildStart() {
      componentsByFile.clear();
      vizByFile.clear();
      usagesByFile.clear();
      builtFiles.clear();
      // 아직 transform 되지 않은 모듈의 내용도 필요하다 — 디스크에서 src/ 를 통째로 읽는다
      project = AosProject.fromDisk(config.root);
    },
    configureServer(server) {
      // 새 파일·삭제는 handleHotUpdate 로 오지 않을 수 있어 watcher 에서 인덱스를 맞춘다
      const onAddOrUnlink = (absolute: string, removed: boolean) => {
        const relative = relativeOf(absolute);
        if (!relative) return;
        syncFile(server, relative, (p) => {
          if (removed) return p.delete(relative);
          try {
            return p.set(relative, fs.readFileSync(absolute, "utf8"));
          } catch {
            return false;
          }
        });
      };
      server.watcher.on("add", (file) => onAddOrUnlink(file, false));
      server.watcher.on("unlink", (file) => onAddOrUnlink(file, true));
    },
    async handleHotUpdate(ctx) {
      if (!config || config.command !== "serve") return;
      const relative = relativeOf(ctx.file);
      if (!relative) return;
      const code = await ctx.read();
      const stale = syncFile(ctx.server, relative, (p) => p.set(relative, code));
      if (stale.length === 0) return;
      // 바뀐 파일의 모듈과 함께, 다른 파일에서 오는 props 때문에 data-aos-functions 가 달라진 모듈도 다시 보낸다
      return [...ctx.modules, ...stale.filter((mod) => !ctx.modules.includes(mod))];
    },
    transform(code, id) {
      if (!config) return null;
      const relative = relativeOf(id);
      if (!relative) return null;
      const isServe = config.command === "serve";
      const current = ensureProject();
      if (!isServe) builtFiles.add(relative);
      // .ts 모듈(FUNCTIONS 상수·유틸)은 주입할 JSX 가 없다 — 인덱스만 최신으로 맞춘다
      if (!TARGET_EXT.test(relative)) {
        current.set(relative, code);
        return null;
      }
      const result = analyzeAosSource(code, relative, { injectLoc: isServe, project: current });

      if (!isServe) {
        componentsByFile.set(relative, result.components);
        vizByFile.set(relative, result.visualizations);
        usagesByFile.set(relative, result.usages);
      }
      if (result.code === null) return null;
      return { code: result.code, map: result.map };
    },
    generateBundle() {
      const current = ensureProject();
      const flows = analyzeProjectDataflow(current);
      const built = [...builtFiles].sort();
      const manifest = buildManifest(
        [...componentsByFile.values()].flat(),
        built.flatMap((file) => fileReport(flows, file)),
        [...vizByFile.values()].flat(),
        [...usagesByFile.values()].flat(),
        projectModules(current, built),
      );
      this.emitFile({
        type: "asset",
        fileName: AOS_MANIFEST_FILE,
        source: JSON.stringify(manifest, null, 2),
      });
    },
  };
}
