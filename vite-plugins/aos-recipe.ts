import { parseExpression } from "@babel/parser";
import { childNodes, isFunctionNode, type Node, unwrap, walk } from "./aos-ast";
import {
  collectComponents,
  type ComponentDef,
  HOOK_NAME,
  isFunctionsMember,
  isHookCall,
  ownedDeclarators,
  patternNames,
  type DataflowResult,
  propertyName,
} from "./aos-dataflow";

// 가공 레시피 추출 (AOS-6186).
//
// 차트·KPI·표에 들어가는 값이 함수 결과를 가공한 것이면(useMemo · map · filter · reduce · 정렬 · 헬퍼 함수),
// 홈은 원본 행만 받아서는 앱과 같은 값을 그릴 수 없다. 그래서 "원본 행 → 그 값" 을 만드는 코드를 빌드 때
// 소스에서 잘라 **닫힌 함수 하나**로 묶어 매니페스트에 싣는다. 홈은 그 함수를 Web Worker 에서 실행한다.
//
//   (__in, __lib) => { …; return <그 값>; }
//     __in[<OntologyFunction UUID>]  함수 결과 행 (앱의 hook data 와 같은 값)
//     __lib[<모듈>][<이름>]          허용한 라이브러리 함수 (RECIPE_LIBRARIES)
//
// 무엇을 담는가 — 값 식에서 출발해 참조를 거꾸로 따라간다.
//  - 컴포넌트 안 선언(`const x = …`, useMemo / useCallback, 지역 함수)
//  - hook 결과(`orders.data`) → `__in[uuid]`, `isLoading` → false, `error` → null
//  - useState 값 → 처음 값으로 굳힌다 (검색어 "", 0 페이지 …). 홈은 화면 조작이 없는 첫 화면을 그린다
//  - props → 그 컴포넌트를 쓰는 자리(다른 파일 포함)의 식. 쓰는 자리마다 값이 다르면 거부한다
//  - 모듈의 const / function → import 를 따라가 파일마다 묶음(`__m0`)으로 담는다
//
// 거부하는 것 (재현 불가로 둔다 — 틀린 값을 그리는 것보다 낫다):
//  - 허용 목록 밖의 전역(window · document · fetch …)·import, React hook(useRef · useContext …),
//    상태를 바꾸는 함수(setX), 반복(`.map`) 안에서만 의미가 있는 값, JSX, 클래스, this
//  - 담은 값을 다른 곳에서 바꾸는 코드(대입 · push · sort …) — 잘라 낸 코드만으로는 같은 값이 안 나온다
//
// 보안 경계는 이 검사가 아니라 홈의 Worker 다. 매니페스트는 샌드박스 빌드 산출물이라 바꿔 쓸 수 있다.
// 여기서는 "홈이 받아 쓸 수 있는 모양인가" 를 보수적으로 가를 뿐이다.

export const RECIPE_INPUT = "__in";
export const RECIPE_LIB = "__lib";
const MAX_DEPTH = 6;
const MAX_SOURCE = 40_000;

/** 레시피가 쓸 수 있는 라이브러리. 홈 Worker 가 같은 목록을 싣는다 (commerceos-application recipe worker) */
export const RECIPE_LIBRARIES: Record<string, readonly string[]> = {
  "date-fns": [
    "addDays",
    "addMonths",
    "addWeeks",
    "addYears",
    "compareAsc",
    "compareDesc",
    "differenceInCalendarDays",
    "differenceInDays",
    "differenceInMonths",
    "eachDayOfInterval",
    "endOfDay",
    "endOfMonth",
    "endOfWeek",
    "endOfYear",
    "format",
    "getDay",
    "getMonth",
    "getYear",
    "isAfter",
    "isBefore",
    "isSameDay",
    "isSameMonth",
    "isValid",
    "isWithinInterval",
    "parse",
    "parseISO",
    "startOfDay",
    "startOfMonth",
    "startOfWeek",
    "startOfYear",
    "subDays",
    "subMonths",
    "subWeeks",
    "subYears",
  ],
  "date-fns/locale": ["enUS", "ko"],
};

const GLOBALS = new Set([
  "Array",
  "Boolean",
  "Date",
  "Infinity",
  "Intl",
  "JSON",
  "Map",
  "Math",
  "NaN",
  "Number",
  "Object",
  "RegExp",
  "Set",
  "String",
  "decodeURIComponent",
  "encodeURIComponent",
  "isFinite",
  "isNaN",
  "parseFloat",
  "parseInt",
  "undefined",
]);

/** 프로토타입을 거쳐 Function 생성자 등에 닿는 이름 — 레시피에 있을 이유가 없다 */
const FORBIDDEN_MEMBERS = new Set([
  "constructor",
  "prototype",
  "__proto__",
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__",
]);

/** 담은 값을 제자리에서 바꾸는 메서드 */
const MUTATORS = new Set(["push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill", "copyWithin", "set", "add", "delete", "clear"]);

/** hook 결과에서 홈이 고정값으로 바꾸는 필드 */
const QUERY_FLAGS: Record<string, string> = {
  isLoading: "false",
  isFetching: "false",
  isPending: "false",
  error: "null",
  refetch: "() => {}",
};

export interface AosRecipe {
  /** `(__in, __lib) => { … }` — 타입을 지운 JS */
  source: string;
  /** __in 의 키 (OntologyFunction UUID) */
  functions: string[];
  /** __lib 로 넘겨야 하는 모듈 */
  libraries: string[];
}

export type RecipeResult =
  | {
      ok: true;
      recipe: AosRecipe;
      /** 함수별로 앱이 넘긴 파라미터를 만드는 레시피 (`(__in, __lib) => ({…})`). 파라미터를 안 넘긴 함수는 없다 */
      parameters: Record<string, string>;
    }
  | { ok: false; reason: string };

class RecipeError extends Error {}

const fail = (reason: string): never => {
  throw new RecipeError(reason);
};

// ─── 스코프 분석: 노드 안에서 선언되지 않은 이름 ─────────────────────────────────

const TS_EXPRESSIONS = new Set(["TSAsExpression", "TSSatisfiesExpression", "TSNonNullExpression", "TSInstantiationExpression"]);

/** useMemo / useCallback — 레시피에서는 콜백을 바로 부르는 것으로 바꾼다 */
function memoHook(call: Node): "useMemo" | "useCallback" | null {
  if (call.type !== "CallExpression") return null;
  const callee = call.callee as Node;
  const name =
    callee.type === "Identifier"
      ? (callee.name as string)
      : callee.type === "MemberExpression" && !callee.computed && (callee.object as Node).type === "Identifier" && (callee.object as Node).name === "React"
        ? (((callee.property as Node).name as string) ?? "")
        : "";
  const first = (call.arguments as Node[])[0];
  if ((name === "useMemo" || name === "useCallback") && first && isFunctionNode(unwrap(first))) return name;
  return null;
}

/** `useXxx(…)` · `React.useXxx(…)` 의 이름 */
function reactHookName(call: Node): string | null {
  if (call.type !== "CallExpression") return null;
  const callee = call.callee as Node;
  const name =
    callee.type === "Identifier"
      ? (callee.name as string)
      : callee.type === "MemberExpression" && !callee.computed && (callee.object as Node).type === "Identifier"
        ? (((callee.property as Node).name as string) ?? "")
        : "";
  return /^use[A-Z0-9]/.test(name) ? name : null;
}

function declaredInStatements(statements: Node[]): string[] {
  const names: string[] = [];
  for (const stmt of statements) {
    const decl = (stmt.type === "ExportNamedDeclaration" ? stmt.declaration : stmt) as Node | null;
    if (!decl) continue;
    if (decl.type === "VariableDeclaration") for (const d of decl.declarations as Node[]) names.push(...patternNames(d.id as Node));
    else if ((decl.type === "FunctionDeclaration" || decl.type === "ClassDeclaration") && decl.id) names.push((decl.id as Node).name as string);
  }
  return names;
}

/** 노드가 참조하지만 그 안에서 선언하지 않은 이름. 레시피로 옮길 수 없는 구문이면 거부한다 */
export function freeNames(root: Node): Set<string> {
  const free = new Set<string>();
  const scopes: Set<string>[] = [];
  const declared = (name: string) => scopes.some((s) => s.has(name));
  const ref = (name: string) => {
    if (!declared(name)) free.add(name);
  };
  const withScope = (names: Iterable<string>, body: () => void) => {
    scopes.push(new Set(names));
    body();
    scopes.pop();
  };
  /** 패턴 안의 기본값 · computed key 만 참조다 (이름은 선언) */
  const patternRefs = (pattern: Node | null | undefined) => {
    if (!pattern) return;
    switch (pattern.type) {
      case "AssignmentPattern":
        patternRefs(pattern.left as Node);
        visit(pattern.right as Node);
        return;
      case "ObjectPattern":
        for (const prop of pattern.properties as Node[]) {
          if (prop.type === "RestElement") patternRefs(prop.argument as Node);
          else {
            if (prop.computed) visit(prop.key as Node);
            patternRefs(prop.value as Node);
          }
        }
        return;
      case "ArrayPattern":
        for (const el of pattern.elements as (Node | null)[]) patternRefs(el);
        return;
      case "RestElement":
        patternRefs(pattern.argument as Node);
        return;
      case "MemberExpression":
        visit(pattern);
        return;
      default:
        return;
    }
  };
  const visitFunction = (fn: Node) => {
    const own = new Set<string>();
    for (const p of fn.params as Node[]) for (const n of patternNames(p.type === "TSParameterProperty" ? (p.parameter as Node) : p)) own.add(n);
    if (fn.type !== "ArrowFunctionExpression") own.add("arguments");
    if (fn.type === "FunctionExpression" && fn.id) own.add((fn.id as Node).name as string);
    if (fn.type === "FunctionDeclaration" && fn.id) own.add((fn.id as Node).name as string);
    withScope(own, () => {
      for (const p of fn.params as Node[]) patternRefs(p);
      visit(fn.body as Node);
    });
  };
  const visit = (node: Node): void => {
    switch (node.type) {
      case "Identifier":
        ref(node.name as string);
        return;
      case "MemberExpression":
      case "OptionalMemberExpression":
        visit(node.object as Node);
        if (node.computed) visit(node.property as Node);
        return;
      case "ObjectProperty":
        if (node.computed) visit(node.key as Node);
        visit(node.value as Node);
        return;
      case "ObjectMethod":
        if (node.computed) visit(node.key as Node);
        visitFunction(node);
        return;
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression":
        visitFunction(node);
        return;
      case "VariableDeclarator":
        patternRefs(node.id as Node);
        if (node.init) visit(node.init as Node);
        return;
      case "Program":
      case "BlockStatement":
        withScope(declaredInStatements(node.body as Node[]), () => {
          for (const child of node.body as Node[]) visit(child);
        });
        return;
      case "ForStatement":
      case "ForInStatement":
      case "ForOfStatement": {
        const head = (node.init ?? node.left) as Node | null;
        const names = head?.type === "VariableDeclaration" ? declaredInStatements([head]) : [];
        withScope(names, () => {
          for (const child of childNodes(node)) visit(child);
        });
        return;
      }
      case "CatchClause":
        withScope(patternNames(node.param as Node | null), () => {
          patternRefs(node.param as Node | null);
          visit(node.body as Node);
        });
        return;
      case "LabeledStatement":
        visit(node.body as Node);
        return;
      case "BreakStatement":
      case "ContinueStatement":
        return;
      case "AssignmentExpression":
        if ((node.left as Node).type === "Identifier") ref((node.left as Node).name as string);
        else patternRefs(node.left as Node);
        visit(node.right as Node);
        return;
      case "CallExpression":
        if (memoHook(node)) {
          visit((node.arguments as Node[])[0]);
          return;
        }
        break;
      case "ThisExpression":
      case "Super":
      case "MetaProperty":
      case "Import":
        fail(`${node.type} 를 쓰는 코드`);
        return;
      case "ClassDeclaration":
      case "ClassExpression":
        fail("클래스를 쓰는 코드");
        return;
      case "JSXElement":
      case "JSXFragment":
        fail("화면(JSX)을 만드는 코드");
        return;
      default:
        break;
    }
    if (TS_EXPRESSIONS.has(node.type)) {
      visit(node.expression as Node);
      return;
    }
    if (node.type.startsWith("TS")) return;
    for (const child of childNodes(node)) visit(child);
  };
  visit(root);
  return free;
}

function rootIdentifier(node: Node): string | null {
  let current = unwrap(node);
  while (current.type === "MemberExpression" || current.type === "OptionalMemberExpression") current = unwrap(current.object as Node);
  return current.type === "Identifier" ? (current.name as string) : null;
}

// ─── 텍스트: 소스를 잘라 타입을 지우고 hook 을 바꾼다 ───────────────────────────

interface Edit {
  start: number;
  end: number;
  text: string;
}

function collectEdits(code: string, root: Node): Edit[] {
  const edits: Edit[] = [];
  walk(root, (node) => {
    switch (node.type) {
      case "TSTypeAnnotation":
      case "TSTypeParameterInstantiation":
      case "TSTypeParameterDeclaration":
        edits.push({ start: node.start, end: node.end, text: "" });
        return;
      case "TSAsExpression":
      case "TSSatisfiesExpression":
      case "TSNonNullExpression":
        edits.push({ start: (node.expression as Node).end, end: node.end, text: "" });
        return;
      case "TSTypeAssertion":
        fail("`<T>x` 타입 단언");
        return;
      case "Identifier":
        if (node.optional) {
          const at = node.start + (node.name as string).length;
          if (code[at] === "?") edits.push({ start: at, end: at + 1, text: "" });
        }
        return;
      case "CallExpression": {
        const hook = memoHook(node);
        if (!hook) return;
        const fn = (node.arguments as Node[])[0];
        edits.push({ start: node.start, end: fn.start, text: "(" });
        edits.push({ start: fn.end, end: node.end, text: hook === "useMemo" ? ")()" : ")" });
        return;
      }
      case "JSXElement":
      case "JSXFragment":
        fail("화면(JSX)을 만드는 코드");
        return;
      default:
        return;
    }
  });
  return edits;
}

function applyEdits(code: string, start: number, end: number, edits: Edit[]): string {
  const sorted = edits
    .filter((e) => e.start >= start && e.end <= end)
    .sort((a, b) => a.start - b.start || b.end - a.end);
  let out = "";
  let cursor = start;
  for (const edit of sorted) {
    if (edit.start < cursor) continue; // 앞의 바꾸기 안에 들어간 편집 (useMemo<T>( 의 타입 인자 등)
    out += code.slice(cursor, edit.start) + edit.text;
    cursor = Math.max(cursor, edit.end);
  }
  return out + code.slice(cursor, end);
}

// ─── 컴포넌트 스코프 ──────────────────────────────────────────────────────────

type Binding =
  | { kind: "input"; key: string; hook: Node }
  | { kind: "query"; key: string; hook: Node }
  | { kind: "value"; text: string; pos: number }
  | { kind: "state"; init: Node | null; pos: number }
  | { kind: "decl"; declarator: Node; declKind: string }
  | { kind: "function"; node: Node }
  | { kind: "prop"; prop: string; fallback: Node | null }
  | { kind: "props" }
  | { kind: "blocked"; reason: string };

interface ComponentScope {
  file: string;
  def: ComponentDef;
  bindings: Map<string, Binding>;
}

function bindParams(def: ComponentDef, bindings: Map<string, Binding>): void {
  const first = (def.fn.params as Node[])[0];
  if (!first) return;
  const param = first.type === "AssignmentPattern" ? (first.left as Node) : first;
  if (param.type === "Identifier") {
    bindings.set(param.name as string, { kind: "props" });
    return;
  }
  if (param.type !== "ObjectPattern") return;
  for (const prop of param.properties as Node[]) {
    if (prop.type === "RestElement") {
      for (const n of patternNames(prop)) bindings.set(n, { kind: "blocked", reason: "props 나머지(...rest)" });
      continue;
    }
    const key = propertyName(prop.key as Node, prop.computed as boolean);
    const value = prop.value as Node;
    if (key && value.type === "Identifier") bindings.set(value.name as string, { kind: "prop", prop: key, fallback: null });
    else if (key && value.type === "AssignmentPattern" && (value.left as Node).type === "Identifier") {
      bindings.set((value.left as Node).name as string, { kind: "prop", prop: key, fallback: value.right as Node });
    } else {
      for (const n of patternNames(value)) bindings.set(n, { kind: "blocked", reason: "props 를 중첩해서 꺼냄" });
    }
  }
}

function buildScope(file: string, def: ComponentDef): ComponentScope {
  const bindings = new Map<string, Binding>();
  bindParams(def, bindings);
  const body = def.fn.body as Node;
  if (body.type === "BlockStatement") {
    for (const stmt of body.body as Node[]) {
      if (stmt.type === "FunctionDeclaration" && stmt.id) bindings.set((stmt.id as Node).name as string, { kind: "function", node: stmt });
    }
  }
  for (const d of ownedDeclarators(def.fn)) {
    const id = d.id as Node;
    const init = d.init ? unwrap(d.init as Node) : null;
    const declKind = "const";
    if (init && isHookCall(init)) {
      const key = isFunctionsMember(((init.arguments as Node[])[0] ?? init) as Node);
      if (!key) {
        for (const n of patternNames(id)) bindings.set(n, { kind: "blocked", reason: `${HOOK_NAME} 의 첫 인자가 FUNCTIONS.<key> 가 아님` });
        continue;
      }
      if (id.type === "Identifier") {
        bindings.set(id.name as string, { kind: "query", key, hook: init });
        continue;
      }
      if (id.type !== "ObjectPattern") {
        for (const n of patternNames(id)) bindings.set(n, { kind: "blocked", reason: "hook 결과를 배열로 꺼냄" });
        continue;
      }
      for (const prop of id.properties as Node[]) {
        if (prop.type === "RestElement") {
          for (const n of patternNames(prop)) bindings.set(n, { kind: "blocked", reason: "hook 결과 나머지(...rest)" });
          continue;
        }
        const field = propertyName(prop.key as Node, prop.computed as boolean);
        let value = prop.value as Node;
        if (value.type === "AssignmentPattern") value = value.left as Node;
        if (value.type !== "Identifier") {
          for (const n of patternNames(value)) bindings.set(n, { kind: "blocked", reason: "hook 결과를 중첩해서 꺼냄" });
          continue;
        }
        const local = value.name as string;
        if (field === "data") bindings.set(local, { kind: "input", key, hook: init });
        else if (field && field in QUERY_FLAGS) bindings.set(local, { kind: "value", text: QUERY_FLAGS[field], pos: d.start });
        else bindings.set(local, { kind: "blocked", reason: `hook 결과의 ${field ?? "?"}` });
      }
      continue;
    }
    const hook = init ? reactHookName(init) : null;
    if (hook === "useState" || hook === "useReducer") {
      if (hook === "useState" && id.type === "ArrayPattern") {
        const [value, setter] = id.elements as (Node | null)[];
        if (value?.type === "Identifier") bindings.set(value.name as string, { kind: "state", init: ((init!.arguments as Node[])[0] as Node) ?? null, pos: d.start });
        else if (value) for (const n of patternNames(value)) bindings.set(n, { kind: "blocked", reason: "상태를 중첩해서 꺼냄" });
        if (setter) for (const n of patternNames(setter)) bindings.set(n, { kind: "blocked", reason: "상태를 바꾸는 함수" });
      } else {
        for (const n of patternNames(id)) bindings.set(n, { kind: "blocked", reason: `${hook} 상태` });
      }
      continue;
    }
    if (hook && hook !== "useMemo" && hook !== "useCallback") {
      for (const n of patternNames(id)) bindings.set(n, { kind: "blocked", reason: `${hook}() 값` });
      continue;
    }
    for (const n of patternNames(id)) bindings.set(n, { kind: "decl", declarator: d, declKind });
  }
  return { file, def, bindings };
}

// ─── 모듈(파일) 단위 묶음 ─────────────────────────────────────────────────────

interface TopDecl {
  node: Node; // VariableDeclarator | FunctionDeclaration
  kind: "const" | "let" | "var" | "function" | "class";
}

function topDeclarations(program: Node): Map<string, TopDecl> {
  const decls = new Map<string, TopDecl>();
  for (const stmt of program.body as Node[]) {
    const decl = (stmt.type === "ExportNamedDeclaration" || stmt.type === "ExportDefaultDeclaration" ? stmt.declaration : stmt) as Node | null;
    if (!decl) continue;
    if (decl.type === "VariableDeclaration") {
      for (const d of decl.declarations as Node[]) {
        for (const n of patternNames(d.id as Node)) decls.set(n, { node: d, kind: decl.kind as "const" | "let" | "var" });
      }
    } else if (decl.type === "FunctionDeclaration" && decl.id) {
      decls.set((decl.id as Node).name as string, { node: decl, kind: "function" });
    } else if (decl.type === "ClassDeclaration" && decl.id) {
      decls.set((decl.id as Node).name as string, { node: decl, kind: "class" });
    }
  }
  return decls;
}

interface ModulePlan {
  index: number;
  file: string;
  /** 이 묶음이 내보내는 지역 이름 */
  needed: Set<string>;
  decls: Set<Node>;
  /** 이 묶음 안에서 쓰는 다른 묶음·라이브러리 이름 → 식 */
  imports: Map<string, string>;
  deps: Set<string>;
}

interface Usage {
  file: string;
  owner: ComponentDef | null;
  opening: Node;
}

function jsxName(name: Node): string {
  if (name.type === "JSXIdentifier") return name.name as string;
  if (name.type === "JSXMemberExpression") return `${jsxName(name.object as Node)}.${jsxName(name.property as Node)}`;
  return "";
}

/**
 * 레시피가 소스를 읽는 통로. 지금은 파일 하나(`singleFileSources`)다 — 템플릿 앱이 `src/App.tsx` 한 파일이라서.
 * 멀티모듈(AOS-4902)이 들어오면 프로젝트 인덱스로 같은 모양을 구현해 바꿔 끼운다 (import 를 따라 다른 파일의
 * 헬퍼 · 컴포넌트 사용처까지 간다).
 */
export interface RecipeSources {
  files(): string[];
  program(file: string): Node | null;
  code(file: string): string | null;
  /** 지역 이름 → import (`import { a as b } from "x"` 면 b → { source: "x", imported: "a" }) */
  imports(file: string): Map<string, { source: string; imported: string; typeOnly: boolean }>;
  /** import 한 이름이 프로젝트 안의 어느 선언인가 — 밖(패키지)이면 "external" */
  resolveName(file: string, name: string): { file: string; local: string } | "external" | "missing" | "unbound";
  /** 그 파일이 쓰는 FUNCTIONS 의 key → OntologyFunction UUID */
  functionIds(file: string): Map<string, string>;
  /** 파일 안의 JSX 엘리먼트 이름이 가리키는 컴포넌트 `파일#이름` (프로젝트 밖이면 null) */
  resolveElement(file: string, element: string): string | null;
}

function importsOf(program: Node): Map<string, { source: string; imported: string; typeOnly: boolean }> {
  const imports = new Map<string, { source: string; imported: string; typeOnly: boolean }>();
  for (const stmt of program.body as Node[]) {
    if (stmt.type !== "ImportDeclaration") continue;
    const source = (stmt.source as Node).value as string;
    for (const spec of stmt.specifiers as Node[]) {
      const imported =
        spec.type === "ImportDefaultSpecifier"
          ? "default"
          : spec.type === "ImportNamespaceSpecifier"
            ? "*"
            : (((spec.imported as Node).name ?? (spec.imported as Node).value) as string);
      imports.set((spec.local as Node).name as string, {
        source,
        imported,
        typeOnly: stmt.importKind === "type" || spec.importKind === "type",
      });
    }
  }
  return imports;
}

/** 파일 하나 — import 한 이름은 모두 프로젝트 밖으로 본다 (허용 라이브러리만 통과한다) */
export function singleFileSources(file: string, program: Node, code: string, flow: DataflowResult): RecipeSources {
  const imports = importsOf(program);
  const components = new Set(collectComponents(program).map((d) => d.name));
  return {
    files: () => [file],
    program: (f) => (f === file ? program : null),
    code: (f) => (f === file ? code : null),
    imports: (f) => (f === file ? imports : new Map()),
    resolveName: (f, name) => (f === file && imports.has(name) ? "external" : "unbound"),
    functionIds: (f) => (f === file ? flow.functionIds : new Map()),
    resolveElement: (f, element) => (f === file && components.has(element) ? `${file}#${element}` : null),
  };
}

/** 소스 전체에서 한 번 만들어 쓰는 색인 */
export class RecipeContext {
  private scopes = new Map<string, ComponentScope>();
  private tops = new Map<string, Map<string, TopDecl>>();
  private usages: Map<string, Usage[]> | null = null;
  private defs = new Map<string, ComponentDef[]>();

  readonly sources: RecipeSources;

  constructor(sources: RecipeSources) {
    this.sources = sources;
  }

  program(file: string): Node {
    return this.sources.program(file) ?? fail(`${file} 를 읽을 수 없음`);
  }

  code(file: string): string {
    return this.sources.code(file) ?? fail(`${file} 소스를 찾을 수 없음`);
  }

  componentDefs(file: string): ComponentDef[] {
    let defs = this.defs.get(file);
    if (!defs) {
      defs = collectComponents(this.program(file));
      this.defs.set(file, defs);
    }
    return defs;
  }

  component(file: string, name: string): ComponentDef {
    return this.componentDefs(file).find((d) => d.name === name) ?? fail(`${name} 컴포넌트를 찾을 수 없음`);
  }

  scope(file: string, def: ComponentDef): ComponentScope {
    const id = `${file}#${def.name}`;
    let scope = this.scopes.get(id);
    if (!scope) {
      scope = buildScope(file, def);
      this.scopes.set(id, scope);
    }
    return scope;
  }

  top(file: string): Map<string, TopDecl> {
    let decls = this.tops.get(file);
    if (!decls) {
      decls = topDeclarations(this.program(file));
      this.tops.set(file, decls);
    }
    return decls;
  }

  functionId(file: string, key: string): string {
    return this.sources.functionIds(file).get(key) ?? fail(`FUNCTIONS.${key} 의 id 를 찾을 수 없음`);
  }

  /** `파일#이름` 컴포넌트를 쓰는 모든 JSX 자리 */
  usagesOf(componentId: string): Usage[] {
    if (!this.usages) {
      const index = new Map<string, Usage[]>();
      for (const file of this.sources.files()) {
        const program = this.sources.program(file);
        if (!program) continue;
        const defs = this.componentDefs(file);
        walk(program, (node) => {
          if (node.type !== "JSXOpeningElement") return;
          const name = jsxName(node.name as Node);
          if (!name) return;
          const target = this.sources.resolveElement(file, name);
          if (!target) return;
          const owner = defs.find((d) => d.fn.start <= node.start && node.start < d.fn.end) ?? null;
          index.set(target, [...(index.get(target) ?? []), { file, owner, opening: node }]);
        });
      }
      this.usages = index;
    }
    return this.usages.get(componentId) ?? [];
  }
}

// ─── 조립 ────────────────────────────────────────────────────────────────────

class RecipeBuilder {
  private modules = new Map<string, ModulePlan>();
  private libraries = new Set<string>();
  private functions = new Set<string>();
  readonly parameters = new Map<string, string>();
  private hooks = new Map<string, Node>();

  private ctx: RecipeContext;
  /** false 면 함수 결과를 못 쓴다 — 파라미터 레시피 (함수를 부르기 전에 계산한다) */
  private allowInputs: boolean;

  constructor(ctx: RecipeContext, allowInputs: boolean) {
    this.ctx = ctx;
    this.allowInputs = allowInputs;
  }

  /** 값 식 하나를 레시피 원문으로 */
  build(file: string, def: ComponentDef, root: Node): AosRecipe {
    const expr = this.emitExpr(file, def, root, 0);
    const modules = this.orderedModules().map((m) => this.moduleText(m));
    const source = `(${RECIPE_INPUT}, ${RECIPE_LIB}) => {\n${modules.join("\n")}${modules.length ? "\n" : ""}return ${expr};\n}`;
    if (source.length > MAX_SOURCE) fail("가공 코드가 너무 큼");
    verify(source);
    return { source, functions: [...this.functions].sort(), libraries: [...this.libraries].sort() };
  }

  private text(file: string, node: Node): string {
    const code = this.ctx.code(file);
    return applyEdits(code, node.start, node.end, collectEdits(code, node));
  }

  private emitExpr(file: string, def: ComponentDef, root: Node, depth: number): string {
    if (depth > MAX_DEPTH) fail("props 를 너무 여러 단계 거쳐 옴");
    const scope = this.ctx.scope(file, def);
    const lines: { pos: number; text: string }[] = [];
    const done = new Set<string>();
    const decls = new Set<Node>();
    const included: Node[] = [root];
    const moduleRefs = new Map<string, string>();

    const need = (name: string) => {
      if (done.has(name) || moduleRefs.has(name)) return;
      const binding = scope.bindings.get(name);
      if (!binding) {
        const ref = this.resolveTop(file, name);
        if (ref !== null) moduleRefs.set(name, ref);
        return;
      }
      done.add(name);
      switch (binding.kind) {
        case "blocked":
          fail(`${name}: ${binding.reason}`);
          return;
        case "input":
          included.push(binding.hook);
          lines.push({ pos: binding.hook.start, text: `const ${name} = ${this.input(file, def, binding.key, binding.hook)};` });
          return;
        case "query":
          included.push(binding.hook);
          lines.push({
            pos: binding.hook.start,
            text: `const ${name} = { data: ${this.input(file, def, binding.key, binding.hook)}, isLoading: false, isFetching: false, isPending: false, error: null, refetch: () => {} };`,
          });
          return;
        case "value":
          lines.push({ pos: binding.pos, text: `const ${name} = ${binding.text};` });
          return;
        case "state": {
          const init = binding.init;
          if (init) {
            included.push(init);
            for (const n of freeNames(init)) need(n);
          }
          const value = !init ? "undefined" : isFunctionNode(unwrap(init)) ? `(${this.text(file, init)})()` : `(${this.text(file, init)})`;
          lines.push({ pos: binding.pos, text: `const ${name} = ${value};` });
          return;
        }
        case "decl": {
          const d = binding.declarator;
          if (decls.has(d)) return;
          decls.add(d);
          included.push(d);
          for (const n of freeNames(d)) need(n);
          const init = d.init ? ` = ${this.text(file, d.init as Node)}` : "";
          lines.push({ pos: d.start, text: `${d.init ? "const" : "let"} ${this.text(file, d.id as Node)}${init};` });
          return;
        }
        case "function":
          included.push(binding.node);
          for (const n of freeNames(binding.node)) need(n);
          lines.push({ pos: binding.node.start, text: this.text(file, binding.node) });
          return;
        case "prop": {
          const value = this.propValue(file, def, binding.prop, depth);
          if (!binding.fallback) {
            lines.push({ pos: -1, text: `const ${name} = ${value};` });
            return;
          }
          for (const n of freeNames(binding.fallback)) need(n);
          lines.push({
            pos: -1,
            text: `const ${name} = ((__v) => __v === undefined ? (${this.text(file, binding.fallback)}) : __v)(${value});`,
          });
          return;
        }
        case "props": {
          const props = this.propsAccessed(def, name);
          const entries = props.map((p) => `${JSON.stringify(p)}: ${this.propValue(file, def, p, depth)}`);
          lines.push({ pos: -1, text: `const ${name} = { ${entries.join(", ")} };` });
          return;
        }
      }
    };

    for (const n of freeNames(root)) need(n);
    this.checkMutations(def, [...done], included);

    const head = [...moduleRefs].map(([n, ref]) => `const ${n} = ${ref};`);
    const body = [...head, ...lines.sort((a, b) => a.pos - b.pos).map((l) => l.text)];
    const value = this.text(file, root);
    return body.length === 0 ? `(${value})` : `(() => {\n${body.join("\n")}\nreturn (${value});\n})()`;
  }

  /** hook 결과 행. 파라미터를 넘겼으면 그것도 레시피로 만든다 */
  private input(file: string, def: ComponentDef, key: string, hook: Node): string {
    if (!this.allowInputs) fail("파라미터가 다른 함수 결과에 따라 바뀜");
    const id = this.ctx.functionId(file, key);
    const previous = this.hooks.get(id);
    if (previous && previous !== hook) fail(`FUNCTIONS.${key} 를 여러 hook 이 다른 조건으로 부름`);
    if (!previous) {
      this.hooks.set(id, hook);
      this.functions.add(id);
      const options = (hook.arguments as Node[])[1];
      if (options) {
        const object = unwrap(options);
        if (object.type !== "ObjectExpression") fail(`FUNCTIONS.${key} 의 옵션을 읽을 수 없음`);
        for (const prop of object.properties as Node[]) {
          if (prop.type === "SpreadElement") fail(`FUNCTIONS.${key} 의 옵션을 펼쳐서 넘김`);
          if (prop.type !== "ObjectProperty" || propertyName(prop.key as Node, prop.computed as boolean) !== "parameters") continue;
          const sub = new RecipeBuilder(this.ctx, false);
          this.parameters.set(id, sub.build(file, def, prop.value as Node).source);
        }
      }
    }
    return `${RECIPE_INPUT}[${JSON.stringify(id)}]`;
  }

  /** 컴포넌트를 쓰는 자리에서 그 prop 에 넘긴 값 */
  private propValue(file: string, def: ComponentDef, prop: string, depth: number): string {
    const usages = this.ctx.usagesOf(`${file}#${def.name}`);
    if (usages.length === 0) fail(`${def.name} 를 쓰는 곳을 찾지 못함`);
    const values = new Set<string>();
    for (const usage of usages) {
      if (!usage.owner) fail(`${def.name} 를 컴포넌트 밖에서 씀`);
      const attrs = usage.opening.attributes as Node[];
      if (attrs.some((a) => a.type === "JSXSpreadAttribute")) fail(`${def.name} 에 props 를 펼쳐서 넘김`);
      const attr = attrs.find((a) => a.type === "JSXAttribute" && (a.name as Node).name === prop);
      const value = attr?.value as Node | null | undefined;
      if (!attr) values.add("undefined");
      else if (!value) values.add("true");
      else if (value.type === "StringLiteral") values.add(JSON.stringify(value.value));
      else if (value.type === "JSXExpressionContainer") {
        const expression = value.expression as Node;
        values.add(expression.type === "JSXEmptyExpression" ? "undefined" : this.emitExpr(usage.file, usage.owner!, expression, depth + 1));
      } else fail(`${def.name} 의 ${prop} 값을 읽을 수 없음`);
    }
    if (values.size > 1) fail(`${def.name} 를 쓰는 곳마다 ${prop} 가 다름`);
    return [...values][0];
  }

  /** `function C(props)` 에서 읽는 `props.x` 이름들. props 를 통째로 넘기면 거부한다 */
  private propsAccessed(def: ComponentDef, name: string): string[] {
    const props = new Set<string>();
    const visit = (node: Node, parent: Node | null) => {
      if (node.type === "Identifier" && node.name === name && node !== (def.fn.params as Node[])[0]) {
        const isObject = parent && (parent.type === "MemberExpression" || parent.type === "OptionalMemberExpression") && parent.object === node;
        if (!isObject) fail("props 를 통째로 다룸");
        const prop = propertyName(parent!.property as Node, parent!.computed as boolean);
        if (!prop) fail("props 를 동적인 이름으로 읽음");
        props.add(prop!);
        return;
      }
      for (const child of childNodes(node)) visit(child, node);
    };
    visit(def.fn.body as Node, null);
    return [...props].sort();
  }

  /** 담은 이름을 잘라 내지 않은 코드가 바꾸면, 잘라 낸 코드만으로는 같은 값이 안 나온다 */
  private checkMutations(def: ComponentDef, names: string[], included: Node[]) {
    if (names.length === 0) return;
    const watched = new Set(names);
    const skip = new Set(included);
    const visit = (node: Node) => {
      if (skip.has(node)) return;
      if (node.type === "AssignmentExpression" || node.type === "UpdateExpression") {
        const target = rootIdentifier((node.left ?? node.argument) as Node);
        if (target && watched.has(target)) fail(`${target} 를 다른 곳에서 바꿈`);
      }
      if (node.type === "CallExpression") {
        const callee = node.callee as Node;
        if ((callee.type === "MemberExpression" || callee.type === "OptionalMemberExpression") && !callee.computed) {
          const method = (callee.property as Node).name as string;
          const target = rootIdentifier(callee.object as Node);
          if (MUTATORS.has(method) && target && watched.has(target)) fail(`${target} 를 다른 곳에서 바꿈 (${method})`);
        }
      }
      for (const child of childNodes(node)) visit(child);
    };
    visit(def.fn.body as Node);
  }

  /** 컴포넌트 밖 이름 — 같은 파일의 선언, import, 허용 전역. 묶음 참조 식을 돌려준다 (전역이면 null) */
  private resolveTop(file: string, name: string): string | null {
    if (this.ctx.top(file).has(name)) {
      this.useModule(file, name);
      return `${this.moduleVar(file)}.${name}`;
    }
    return this.resolveImport(file, name);
  }

  private resolveImport(file: string, name: string): string | null {
    const binding = this.ctx.sources.imports(file).get(name);
    if (binding) {
      if (binding.typeOnly) fail(`${name} 는 타입`);
      const allowed = RECIPE_LIBRARIES[binding.source];
      if (allowed) {
        if (!allowed.includes(binding.imported)) fail(`${binding.source} 의 ${binding.imported} 는 홈에서 쓸 수 없음`);
        this.libraries.add(binding.source);
        return `${RECIPE_LIB}[${JSON.stringify(binding.source)}][${JSON.stringify(binding.imported)}]`;
      }
      const found = this.ctx.sources.resolveName(file, name);
      if (typeof found !== "object") fail(`${binding.source} 에서 가져온 ${name} 는 홈에서 쓸 수 없음`);
      const target = found as { file: string; local: string };
      this.useModule(target.file, target.local);
      return `${this.moduleVar(target.file)}.${target.local}`;
    }
    if (GLOBALS.has(name)) return null;
    return fail(`${name} 를 홈에서 쓸 수 없음`);
  }

  private plan(file: string): ModulePlan {
    let plan = this.modules.get(file);
    if (!plan) {
      plan = { index: this.modules.size, file, needed: new Set(), decls: new Set(), imports: new Map(), deps: new Set() };
      this.modules.set(file, plan);
    }
    return plan;
  }

  private moduleVar(file: string): string {
    return `__m${this.plan(file).index}`;
  }

  private useModule(file: string, local: string) {
    const plan = this.plan(file);
    if (plan.needed.has(local)) return;
    const decl = this.ctx.top(file).get(local);
    if (!decl) fail(`${file} 에 ${local} 선언이 없음`);
    if (local === "FUNCTIONS") fail("FUNCTIONS 를 값으로 씀");
    if (decl!.kind !== "const" && decl!.kind !== "function") fail(`${local} 는 ${decl!.kind} 선언`);
    plan.needed.add(local);
    if (plan.decls.has(decl!.node)) return;
    plan.decls.add(decl!.node);
    for (const name of freeNames(decl!.node)) {
      if (name === local || plan.imports.has(name)) continue;
      if (this.ctx.top(file).has(name)) {
        this.useModule(file, name);
        continue;
      }
      const ref = this.resolveImport(file, name);
      if (ref === null) continue;
      plan.imports.set(name, ref);
      const match = /^__m(\d+)\./.exec(ref);
      if (match) {
        const dep = [...this.modules.values()].find((m) => m.index === Number(match[1]));
        if (dep) plan.deps.add(dep.file);
      }
    }
  }

  private orderedModules(): ModulePlan[] {
    const ordered: ModulePlan[] = [];
    const state = new Map<string, "visiting" | "done">();
    const visit = (plan: ModulePlan) => {
      const current = state.get(plan.file);
      if (current === "done") return;
      if (current === "visiting") fail("모듈이 서로를 가져옴(순환)");
      state.set(plan.file, "visiting");
      for (const dep of plan.deps) visit(this.modules.get(dep)!);
      state.set(plan.file, "done");
      ordered.push(plan);
    };
    for (const plan of [...this.modules.values()].sort((a, b) => a.index - b.index)) visit(plan);
    return ordered;
  }

  private moduleText(plan: ModulePlan): string {
    const lines = [...plan.imports].map(([n, ref]) => `const ${n} = ${ref};`);
    for (const node of [...plan.decls].sort((a, b) => a.start - b.start)) {
      if (node.type === "FunctionDeclaration") lines.push(this.text(plan.file, node));
      else lines.push(`const ${this.text(plan.file, node.id as Node)} = ${this.text(plan.file, node.init as Node)};`);
    }
    const exported = [...plan.needed].sort().join(", ");
    return `const __m${plan.index} = (() => {\n${lines.join("\n")}\nreturn { ${exported} };\n})();`;
  }
}

/** 만든 원문이 JS 로 읽히고, 허용한 이름만 쓰는지 다시 본다 */
function verify(source: string) {
  let ast: Node;
  try {
    ast = parseExpression(source, { sourceType: "module" }) as unknown as Node;
  } catch (cause) {
    fail(`가공 코드를 옮기지 못함 (${(cause as Error).message})`);
    return;
  }
  for (const name of freeNames(ast)) {
    if (!GLOBALS.has(name)) fail(`${name} 를 홈에서 쓸 수 없음`);
  }
  walk(ast, (node) => {
    if (node.type !== "MemberExpression" && node.type !== "OptionalMemberExpression") return;
    const property = node.property as Node;
    const name = node.computed ? (property.type === "StringLiteral" ? (property.value as string) : null) : (property.name as string);
    if (name && FORBIDDEN_MEMBERS.has(name)) fail(`${name} 에 접근함`);
  });
}

/**
 * `file` 의 `componentName` 안에 있는 값 식 `root` 를 레시피로 만든다.
 * 직접 넘긴 값(가공 없음)이어도 만든다 — 파라미터 레시피가 필요하다.
 */
export function buildRecipe(ctx: RecipeContext, file: string, componentName: string, root: Node): RecipeResult {
  try {
    const def = ctx.component(file, componentName);
    const builder = new RecipeBuilder(ctx, true);
    const recipe = builder.build(file, def, root);
    if (recipe.functions.length === 0) fail("함수 결과를 쓰지 않음");
    return { ok: true, recipe, parameters: Object.fromEntries(builder.parameters) };
  } catch (cause) {
    if (cause instanceof RecipeError) return { ok: false, reason: cause.message };
    throw cause;
  }
}

/**
 * 정적인 값(표 컬럼 정의 등)의 정의 식을 찾는다 — 지역 선언 · useMemo 본문 · 모듈 선언 · props(쓰는 자리가 하나로
 * 정해질 때)를 따라간다. 못 찾으면 null.
 */
export function resolveDefinition(
  ctx: RecipeContext,
  file: string,
  componentName: string,
  expr: Node,
): { file: string; node: Node; component: string | null } | null {
  try {
    return follow(ctx, file, ctx.component(file, componentName), unwrap(expr), 0);
  } catch (cause) {
    if (cause instanceof RecipeError) return null;
    throw cause;
  }
}

function follow(
  ctx: RecipeContext,
  file: string,
  def: ComponentDef | null,
  node: Node,
  depth: number,
): { file: string; node: Node; component: string | null } | null {
  if (depth > MAX_DEPTH) return null;
  const current = unwrap(node);
  const hook = memoHook(current);
  if (hook === "useMemo") {
    const fn = unwrap((current.arguments as Node[])[0]);
    let body = fn.body as Node;
    if (body.type === "BlockStatement") {
      const stmts = body.body as Node[];
      if (stmts.length !== 1 || stmts[0].type !== "ReturnStatement" || !stmts[0].argument) return null;
      body = stmts[0].argument as Node;
    }
    return follow(ctx, file, def, body, depth + 1);
  }
  if (current.type !== "Identifier") return { file, node: current, component: def?.name ?? null };
  const name = current.name as string;
  const binding = def ? ctx.scope(file, def).bindings.get(name) : undefined;
  if (binding?.kind === "decl") {
    const init = binding.declarator.init as Node | null;
    return init && (binding.declarator.id as Node).type === "Identifier" ? follow(ctx, file, def, init, depth + 1) : null;
  }
  if (binding?.kind === "prop" && def) {
    const usages = ctx.usagesOf(`${file}#${def.name}`);
    if (usages.length !== 1 || !usages[0].owner) return null;
    const attr = (usages[0].opening.attributes as Node[]).find((a) => a.type === "JSXAttribute" && (a.name as Node).name === binding.prop);
    const value = attr?.value as Node | undefined;
    if (value?.type !== "JSXExpressionContainer") return null;
    return follow(ctx, usages[0].file, usages[0].owner, value.expression as Node, depth + 1);
  }
  if (binding) return null;
  const top = ctx.top(file).get(name);
  if (top && top.node.type === "VariableDeclarator" && (top.node.id as Node).type === "Identifier" && top.node.init) {
    return follow(ctx, file, null, top.node.init as Node, depth + 1);
  }
  const found = ctx.sources.resolveName(file, name);
  if (typeof found === "object") {
    const target = ctx.top(found.file).get(found.local);
    if (target && target.node.type === "VariableDeclarator" && target.node.init) return follow(ctx, found.file, null, target.node.init as Node, depth + 1);
  }
  return null;
}
