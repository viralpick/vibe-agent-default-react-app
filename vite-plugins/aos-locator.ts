import path from "path";
import { parse } from "@babel/parser";
import MagicString from "magic-string";
import type { Plugin, ResolvedConfig } from "vite";

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
// plugin-react 의 babel 옵션 안이 아니라 `enforce: "pre"` 독립 플러그인으로 둔다. 뒤에 오는 JSX
// 변환기(Babel / Oxc)가 바뀌어도 이 플러그인은 그대로 동작한다 (Vite 8 + plugin-react 6 대비).

export const AOS_MANIFEST_FILE = "aos-manifest.json";
export const AOS_MANIFEST_VERSION = 1;

export interface AosComponent {
  /** data-aos-id 값 */
  id: string;
  /** data-aos-name 값 (없으면 null — 호스트가 id 에서 PascalCase 로 유도한다) */
  name: string | null;
  /** JSX 엘리먼트 이름 (`Card`, `KpiCard`, `section` ...) */
  element: string;
  /** data-aos-functions 의 OntologyFunction id 목록 */
  functions: string[];
  /** 정적 문자열이 아니라 해석하지 못한 data-aos-functions 표현식 원문 (없으면 null) */
  functionsExpression: string | null;
  /** `src/App.tsx:120:8` — 라인 1-based, 칼럼 1-based */
  loc: string;
}

export interface AosManifest {
  version: number;
  components: AosComponent[];
  /** 두 번 이상 선언된 data-aos-id — 클릭 대상이 모호해진다 */
  duplicateIds: string[];
}

export interface AnalyzeResult {
  /** 주입이 일어났을 때만 값이 있다 */
  code: string | null;
  map: ReturnType<MagicString["generateMap"]> | null;
  components: AosComponent[];
}

interface Node {
  type: string;
  start: number;
  end: number;
  loc: { start: { line: number; column: number } };
  [key: string]: unknown;
}

const AOS_ID = "data-aos-id";
const AOS_NAME = "data-aos-name";
const AOS_FUNCTIONS = "data-aos-functions";
const AOS_LOC = "data-aos-loc";

// AST 순회 시 건너뛸 메타 필드 (자식 노드가 아니다)
const SKIP_KEYS = new Set(["loc", "start", "end", "extra", "leadingComments", "trailingComments", "innerComments"]);

function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && typeof (value as Node).type === "string";
}

function walk(node: Node, visit: (node: Node) => void): void {
  visit(node);
  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) if (isNode(item)) walk(item, visit);
    } else if (isNode(child)) {
      walk(child, visit);
    }
  }
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
    return { code: null, map: null, components: [] };
  }

  const s = new MagicString(code);
  const components: AosComponent[] = [];
  let injected = false;

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

    const idAttr = attrs.get(AOS_ID);
    const id = staticString(idAttr?.value as Node | undefined);
    if (id !== null) {
      const fnValue = attrs.get(AOS_FUNCTIONS)?.value as Node | undefined;
      const fnRaw = staticString(fnValue);
      components.push({
        id,
        name: staticString(attrs.get(AOS_NAME)?.value as Node | undefined),
        element,
        functions: fnRaw === null ? [] : splitFunctions(fnRaw),
        functionsExpression: fnValue && fnRaw === null ? code.slice(fnValue.start, fnValue.end) : null,
        loc,
      });
    }

    if (!options.injectLoc || attrs.has(AOS_LOC)) return;
    if (!isHostElement(nameNode) && !idAttr) return;

    // 제네릭 컴포넌트(`<Select<Option> ...>`)면 타입 인자 뒤에 넣어야 문법이 유지된다.
    const typeArgs = (node.typeArguments ?? node.typeParameters) as Node | undefined;
    s.appendLeft(typeArgs ? typeArgs.end : nameNode.end, ` ${AOS_LOC}="${loc}"`);
    injected = true;
  });

  if (!injected) return { code: null, map: null, components };
  return {
    code: s.toString(),
    // source 는 비워 둔다 — Vite 가 transform 체인의 map 을 합칠 때 모듈 id 로 채운다.
    map: s.generateMap({ hires: "boundary" }),
    components,
  };
}

export function buildManifest(components: AosComponent[]): AosManifest {
  const sorted = [...components].sort((a, b) => a.loc.localeCompare(b.loc, "en", { numeric: true }));
  const counts = new Map<string, number>();
  for (const c of sorted) counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
  const duplicateIds = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort();
  return { version: AOS_MANIFEST_VERSION, components: sorted, duplicateIds };
}

const TARGET_EXT = /\.[jt]sx$/;
const EXCLUDED = /(\/node_modules\/|\/src\/test\/|\.(test|spec)\.[jt]sx$)/;

export function aosLocator(): Plugin {
  let config: ResolvedConfig;
  // build 는 모듈마다 transform 이 한 번 돈다. 파일 단위로 덮어써 재변환에도 중복이 생기지 않게 한다.
  const componentsByFile = new Map<string, AosComponent[]>();

  return {
    name: "aos-locator",
    enforce: "pre",
    configResolved(resolved) {
      config = resolved;
    },
    buildStart() {
      componentsByFile.clear();
    },
    transform(code, id) {
      const file = id.split("?", 1)[0];
      if (!TARGET_EXT.test(file) || EXCLUDED.test(file)) return null;
      const srcRoot = path.join(config.root, "src") + path.sep;
      if (!file.startsWith(srcRoot)) return null;

      const relative = path.relative(config.root, file).split(path.sep).join("/");
      const isServe = config.command === "serve";
      const result = analyzeAosSource(code, relative, { injectLoc: isServe });

      if (!isServe) componentsByFile.set(relative, result.components);
      if (result.code === null) return null;
      return { code: result.code, map: result.map };
    },
    generateBundle() {
      const manifest = buildManifest([...componentsByFile.values()].flat());
      this.emitFile({
        type: "asset",
        fileName: AOS_MANIFEST_FILE,
        source: JSON.stringify(manifest, null, 2),
      });
    },
  };
}
