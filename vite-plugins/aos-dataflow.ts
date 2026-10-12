import { childNodes, isFunctionNode, isNode, isPascalCase, locOf, type Node, unwrap, walk } from "./aos-ast";
import { AosProject } from "./aos-project";

// 컴포넌트 → OntologyFunction 데이터 흐름 추적 (AOS-4888).
//
// 생성된 앱이 데이터를 `useOntologyFunction(FUNCTIONS.<key>, …)` 로만 가져온다는 계약 위에서,
// "어느 컴포넌트가 어느 함수의 데이터를 그리는지" 를 소스 AST 만으로 계산한다. LLM 이
// data-aos-functions 에 UUID 를 베껴 쓰던 것을 대체한다.
//
// 규칙 (파일 단위, 고정점까지 반복 — 선언 순서와 무관):
//  1. 출발점 — `useOntologyFunction(FUNCTIONS.k)` 결과의 `data` 만 k 를 운반한다.
//     `isLoading` / `error` / `refetch` 는 운반하지 않는다.
//  2. 전파 — `const x = <식>` 의 식이 k 를 운반하는 식별자를 참조하면 x 도 k 를 운반한다
//     (`useMemo(() => …)` 안의 참조 포함). `arr.map(row => …)` 처럼 운반 값의 메서드에 넘긴
//     콜백의 파라미터도 k 를 운반한다.
//  3. 도착점 — `<Comp prop={x} />` 의 prop 이 k 를 운반하면 Comp 의 그 prop 이 k 를 받는다.
//     Comp 가 받은 prop 을 다시 자식에 넘기면 따라 내려간다.
//
// 이 계약을 벗어난 모양은 추적하지 않고 violations 로 보고한다 — 틀린 값을 조용히 내는 대신
// 거부한다. (예: `apiClient.post(`/ontology-functions/${FUNCTIONS.x.id}/run`)` 직접 호출)
//
// 멀티모듈 (AOS-4902): 추적은 파일이 아니라 프로젝트 단위다 (aos-project 인덱스).
//  - FUNCTIONS 는 그 파일의 선언, 없으면 그 파일이 import 한 모듈의 선언을 쓴다.
//  - 컴포넌트 정체는 `파일#이름` 이다. `<Comp>` 는 같은 파일의 선언 → import 를 따라간 선언 순으로 찾는다.
//  - prop 전달은 파일 경계를 넘어 같은 고정점 반복 안에서 퍼진다.
//  - 운반하는 key 는 "어느 파일의 FUNCTIONS 인가" 를 함께 든다(qualified key). 다른 파일이 같은 key 이름을
//    다른 UUID 로 선언해도 섞이지 않는다. 결과의 functionKeys 는 예전처럼 key 이름만 싣고, UUID 는
//    functionIds 로 따로 풀어 둔다.

export const HOOK_NAME = "useOntologyFunction";
const FUNCTIONS_NAME = "FUNCTIONS";
// hook 결과에서 함수 데이터를 운반하지 않는 필드
const CLEAN_RESULT_FIELDS = new Set(["isLoading", "error", "refetch"]);

export interface Taint {
  /** FUNCTIONS 의 key */
  keys: Set<string>;
  /** hook 결과 data 를 변환 없이 그대로 가리키는가 (별칭·prop 전달만 거쳤는가) */
  direct: boolean;
}

export interface DataBinding {
  /** 값을 받는 JSX 엘리먼트 (`LineChart`, `KpiGrid` …) */
  element: string;
  prop: string;
  loc: string;
  functionKeys: string[];
  /** functionKeys 를 각자 선언된 FUNCTIONS 로 풀어 낸 OntologyFunction id */
  functionIds: string[];
  direct: boolean;
}

export interface DataflowViolation {
  rule:
    | "functions-outside-hook"
    | "functions-dynamic-key"
    | "functions-escape"
    | "hook-arg-not-functions"
    | "unknown-function-key"
    | "direct-run-call";
  loc: string;
  message: string;
}

export interface ComponentFlow {
  /** `src/modules/SalesChart.tsx#SalesChart` — 파일이 달라도 같은 이름이 섞이지 않게 */
  id: string;
  name: string;
  start: number;
  end: number;
  functionKeys: string[];
  functionIds: string[];
  bindings: DataBinding[];
}

export interface DataflowResult {
  /** 이 파일이 쓰는 FUNCTIONS 상수(자기 선언 또는 import 한 선언)의 key → OntologyFunction UUID */
  functionIds: Map<string, string>;
  components: ComponentFlow[];
  violations: DataflowViolation[];
  /** 파일이 hook 을 한 번이라도 쓰는가 (기존 앱 = Promise.all 패턴 판별용) */
  usesHook: boolean;
}

const EMPTY: Taint = { keys: new Set(), direct: true };

function merge(a: Taint, b: Taint): Taint {
  if (a.keys.size === 0) return b;
  if (b.keys.size === 0) return a;
  return { keys: new Set([...a.keys, ...b.keys]), direct: a.direct && b.direct };
}

function undirect(t: Taint): Taint {
  return t.keys.size === 0 || !t.direct ? t : { keys: t.keys, direct: false };
}

function sameTaint(a: Taint | undefined, b: Taint): boolean {
  if (!a) return b.keys.size === 0;
  return a.direct === b.direct && a.keys.size === b.keys.size && [...b.keys].every((k) => a.keys.has(k));
}

export function propertyName(node: Node, computed: boolean): string | null {
  if (!computed && node.type === "Identifier") return node.name as string;
  if (node.type === "StringLiteral") return node.value as string;
  return null;
}

export function patternNames(pattern: Node | null | undefined): string[] {
  if (!pattern) return [];
  switch (pattern.type) {
    case "Identifier":
      return [pattern.name as string];
    case "AssignmentPattern":
      return patternNames(pattern.left as Node);
    case "RestElement":
      return patternNames(pattern.argument as Node);
    case "ArrayPattern":
      return (pattern.elements as (Node | null)[]).flatMap((el) => patternNames(el));
    case "ObjectPattern":
      return (pattern.properties as Node[]).flatMap((p) =>
        p.type === "RestElement" ? patternNames(p) : patternNames(p.value as Node),
      );
    default:
      return [];
  }
}

export function isFunctionsMember(node: Node): string | null {
  if (node.type !== "MemberExpression" || node.computed) return null;
  const object = node.object as Node;
  if (object.type !== "Identifier" || object.name !== FUNCTIONS_NAME) return null;
  return propertyName(node.property as Node, false);
}

export function isHookCall(node: Node): boolean {
  const call = unwrap(node);
  return (
    call.type === "CallExpression" &&
    (call.callee as Node).type === "Identifier" &&
    (call.callee as Node).name === HOOK_NAME
  );
}

// ─── 수집: FUNCTIONS 상수, top-level 컴포넌트 ─────────────────────────────────

function collectFunctionIds(program: Node): Map<string, string> {
  const ids = new Map<string, string>();
  walk(program, (node) => {
    if (node.type !== "VariableDeclarator") return;
    const id = node.id as Node;
    if (id.type !== "Identifier" || id.name !== FUNCTIONS_NAME || !node.init) return;
    const init = unwrap(node.init as Node);
    if (init.type !== "ObjectExpression") return;
    for (const prop of init.properties as Node[]) {
      if (prop.type !== "ObjectProperty") continue;
      const key = propertyName(prop.key as Node, prop.computed as boolean);
      const value = unwrap(prop.value as Node);
      if (!key || value.type !== "ObjectExpression") continue;
      for (const field of value.properties as Node[]) {
        if (field.type !== "ObjectProperty" || propertyName(field.key as Node, false) !== "id") continue;
        const idValue = unwrap(field.value as Node);
        if (idValue.type === "StringLiteral") ids.set(key, idValue.value as string);
      }
    }
  });
  return ids;
}

/**
 * hook 자신을 정의한 모듈인가 (`export function useOntologyFunction`). 그 모듈은 `/ontology-functions/{id}/run`
 * 을 부르는 유일하게 허용된 자리라 위반을 보지 않는다 — 멀티모듈에서 .ts 모듈까지 분석하면서 생긴 구분이다.
 */
function definesHook(program: Node): boolean {
  return (program.body as Node[]).some((stmt) => {
    const decl = (stmt.type === "ExportNamedDeclaration" ? stmt.declaration : stmt) as Node | null;
    if (!decl) return false;
    if (decl.type === "FunctionDeclaration") return (decl.id as Node | null)?.name === HOOK_NAME;
    if (decl.type === "VariableDeclaration") {
      return (decl.declarations as Node[]).some((d) => (d.id as Node).type === "Identifier" && (d.id as Node).name === HOOK_NAME);
    }
    return false;
  });
}

function declaresFunctions(program: Node): boolean {
  let found = false;
  walk(program, (node) => {
    if (node.type === "VariableDeclarator" && (node.id as Node).type === "Identifier" && (node.id as Node).name === FUNCTIONS_NAME) found = true;
  });
  return found;
}

export interface ComponentDef {
  name: string;
  fn: Node;
}

/** memo(fn) / forwardRef(fn) / React.memo(fn) 처럼 감싼 함수를 꺼낸다 */
function componentFunction(init: Node | null | undefined): Node | null {
  if (!init) return null;
  const node = unwrap(init);
  if (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression") return node;
  if (node.type === "CallExpression") {
    const first = (node.arguments as Node[])[0];
    return first ? componentFunction(first) : null;
  }
  return null;
}

export function collectComponents(program: Node): ComponentDef[] {
  const defs: ComponentDef[] = [];
  const fromDeclaration = (decl: Node | null | undefined) => {
    if (!decl) return;
    if (decl.type === "FunctionDeclaration" && decl.id && isPascalCase((decl.id as Node).name as string)) {
      defs.push({ name: (decl.id as Node).name as string, fn: decl });
    } else if (decl.type === "VariableDeclaration") {
      for (const d of decl.declarations as Node[]) {
        const id = d.id as Node;
        const fn = componentFunction(d.init as Node);
        if (id.type === "Identifier" && isPascalCase(id.name as string) && fn) {
          defs.push({ name: id.name as string, fn });
        }
      }
    }
  };
  for (const stmt of program.body as Node[]) {
    if (stmt.type === "ExportNamedDeclaration" || stmt.type === "ExportDefaultDeclaration") {
      fromDeclaration(stmt.declaration as Node);
    } else {
      fromDeclaration(stmt);
    }
  }
  return defs;
}

// ─── 컴포넌트 단위 분석 ────────────────────────────────────────────────────────

interface PropState {
  props: Map<string, Taint>;
  spread: Taint;
}

interface Env {
  bindings: Map<string, Taint>;
  /** `const brand = useOntologyFunction(FUNCTIONS.k)` → brand → k */
  queries: Map<string, string>;
  /** `function C(props)` 의 props 식별자 */
  propsIdent: string | null;
  propState: PropState;
}

function propTaint(state: PropState, prop: string): Taint {
  return merge(state.props.get(prop) ?? EMPTY, state.spread);
}

function allPropsTaint(state: PropState): Taint {
  let t = state.spread;
  for (const v of state.props.values()) t = merge(t, v);
  return undirect(t);
}

/** `row => row && typeof row === "object"` · `Boolean` · `row => row != null` 처럼 행을 거르지 않는 null 방어 술어인가 */
function isNullGuard(fn: Node): boolean {
  if (fn.type === "Identifier") return fn.name === "Boolean";
  if (fn.type !== "ArrowFunctionExpression" && fn.type !== "FunctionExpression") return false;
  const param = (fn.params as Node[])[0];
  if (!param || param.type !== "Identifier") return false;
  const name = param.name as string;
  let body = fn.body as Node;
  if (body.type === "BlockStatement") {
    const stmts = body.body as Node[];
    if (stmts.length !== 1 || stmts[0].type !== "ReturnStatement" || !stmts[0].argument) return false;
    body = stmts[0].argument as Node;
  }
  const isParam = (n: Node) => unwrap(n).type === "Identifier" && unwrap(n).name === name;
  const isGuardTerm = (n: Node): boolean => {
    const t = unwrap(n);
    if (isParam(t)) return true; // row
    if (t.type === "CallExpression" && (t.callee as Node).type === "Identifier" && (t.callee as Node).name === "Boolean") {
      return isParam((t.arguments as Node[])[0] ?? t);
    }
    if (t.type === "BinaryExpression") {
      const left = unwrap(t.left as Node);
      const right = unwrap(t.right as Node);
      // row != null / row !== null / row !== undefined
      if (["!=", "!=="].includes(t.operator as string) && isParam(left) && (right.type === "NullLiteral" || (right.type === "Identifier" && right.name === "undefined"))) return true;
      // typeof row === "object"
      if (["==", "==="].includes(t.operator as string) && left.type === "UnaryExpression" && left.operator === "typeof" && isParam(left.argument as Node) && right.type === "StringLiteral" && right.value === "object") return true;
    }
    if (t.type === "LogicalExpression" && t.operator === "&&") return isGuardTerm(t.left as Node) && isGuardTerm(t.right as Node);
    return false;
  };
  return isGuardTerm(body);
}

/**
 * 값을 바꾸지 않는 감싸기를 벗긴다 — direct 판정용 (AOS-4929).
 *  - `useMemo(() => x, deps)` → x
 *  - `x.filter(row => row && typeof row === "object")` 같은 null 방어 → x
 * LLM 이 방어적으로 붙이는 이 모양 때문에 함수 결과를 그대로 넘긴 차트가 "가공됨" 으로 판정되던 것을 막는다.
 * 실제로 행을 바꾸는 것(map · 조건 filter · slice · sort)은 벗기지 않는다.
 */
function peelPassThrough(node: Node): Node {
  let current = unwrap(node);
  for (;;) {
    if (current.type === "CallExpression") {
      const callee = current.callee as Node;
      const args = current.arguments as Node[];
      if (callee.type === "Identifier" && callee.name === "useMemo" && args[0] && isFunctionNode(args[0])) {
        let body = args[0].body as Node;
        if (body.type === "BlockStatement") {
          const stmts = body.body as Node[];
          if (stmts.length !== 1 || stmts[0].type !== "ReturnStatement" || !stmts[0].argument) return current;
          body = stmts[0].argument as Node;
        }
        current = unwrap(body);
        continue;
      }
      if (
        (callee.type === "MemberExpression" || callee.type === "OptionalMemberExpression") &&
        !callee.computed &&
        (callee.property as Node).type === "Identifier" &&
        (callee.property as Node).name === "filter" &&
        args.length === 1 &&
        isNullGuard(unwrap(args[0]))
      ) {
        current = unwrap(callee.object as Node);
        continue;
      }
    }
    return current;
  }
}

/** 식이 운반하는 taint. direct 는 식이 별칭 형태(식별자·멤버 접근)일 때만 유지된다 */
function exprTaint(expr: Node, env: Env, locals: Map<string, Taint> = new Map()): Taint {
  let acc: Taint = EMPTY;
  const add = (t: Taint) => {
    acc = merge(acc, t);
  };
  const lookup = (name: string): Taint | null => {
    if (locals.has(name)) return locals.get(name)!;
    if (env.queries.has(name)) return { keys: new Set([env.queries.get(name)!]), direct: false };
    if (env.propsIdent === name) return allPropsTaint(env.propState);
    return env.bindings.get(name) ?? null;
  };

  const visit = (node: Node) => {
    if (node.type === "MemberExpression" || node.type === "OptionalMemberExpression") {
      const object = unwrap(node.object as Node);
      if (object.type === "Identifier") {
        const base = object.name as string;
        const prop = propertyName(node.property as Node, node.computed as boolean);
        if (!locals.has(base) && env.queries.has(base)) {
          if (prop === "data") add({ keys: new Set([env.queries.get(base)!]), direct: true });
          else if (!(prop && CLEAN_RESULT_FIELDS.has(prop))) add({ keys: new Set([env.queries.get(base)!]), direct: false });
          return;
        }
        if (!locals.has(base) && env.propsIdent === base && prop) {
          add(propTaint(env.propState, prop));
          return;
        }
      }
      visit(object);
      if (node.computed) visit(node.property as Node);
      return;
    }
    if (node.type === "Identifier") {
      const t = lookup(node.name as string);
      if (t) add(t);
      return;
    }
    if (node.type === "ObjectProperty") {
      if (node.computed) visit(node.key as Node);
      visit(node.value as Node);
      return;
    }
    if (node.type === "JSXAttribute") {
      if (node.value) visit(node.value as Node);
      return;
    }
    if (node.type === "JSXIdentifier" || node.type === "JSXMemberExpression" || node.type === "JSXNamespacedName") {
      return;
    }
    if (isFunctionNode(node)) {
      visit(node.body as Node);
      return;
    }
    if (node.type.startsWith("TS")) {
      if (isNode(node.expression)) visit(node.expression as Node);
      return;
    }
    for (const child of childNodes(node)) visit(child);
  };

  visit(expr);
  const target = peelPassThrough(unwrap(expr));
  const aliasForm = target.type === "Identifier" || target.type === "MemberExpression" || target.type === "OptionalMemberExpression";
  return aliasForm ? acc : undirect(acc);
}

/** 컴포넌트 함수 자신이 소유한 변수 선언 (중첩 함수 안의 선언은 제외) */
export function ownedDeclarators(fn: Node): Node[] {
  const found: Node[] = [];
  const visit = (node: Node) => {
    if (node !== fn && isFunctionNode(node)) return;
    if (node.type === "VariableDeclarator") found.push(node);
    for (const child of childNodes(node)) visit(child);
  };
  visit(fn.body as Node);
  return found;
}

function bindParams(fn: Node, env: Env): void {
  const first = (fn.params as Node[])[0];
  if (!first) return;
  const param = first.type === "AssignmentPattern" ? (first.left as Node) : first;
  if (param.type === "Identifier") {
    env.propsIdent = param.name as string;
    return;
  }
  if (param.type !== "ObjectPattern") return;
  for (const prop of param.properties as Node[]) {
    if (prop.type === "RestElement") {
      const rest = patternNames(prop)[0];
      if (rest) env.propsIdent = rest;
      continue;
    }
    const key = propertyName(prop.key as Node, prop.computed as boolean);
    if (!key) continue;
    for (const local of patternNames(prop.value as Node)) {
      env.bindings.set(local, propTaint(env.propState, key));
    }
  }
}

interface Sink {
  element: string;
  prop: string | null; // null = spread
  node: Node;
  taint: Taint;
}

function jsxName(name: Node): string {
  if (name.type === "JSXIdentifier") return name.name as string;
  if (name.type === "JSXMemberExpression") return `${jsxName(name.object as Node)}.${jsxName(name.property as Node)}`;
  return "";
}

/** JSX 속성으로 흘러가는 값. `arr.map(row => …)` 콜백 파라미터는 arr 의 taint 를 받는다 */
function collectSinks(fn: Node, env: Env): Sink[] {
  const sinks: Sink[] = [];
  const visit = (node: Node, locals: Map<string, Taint>) => {
    if (node.type === "CallExpression" && (node.callee as Node).type === "MemberExpression") {
      const carried = undirect(exprTaint((node.callee as Node).object as Node, env, locals));
      visit(node.callee as Node, locals);
      for (const arg of node.arguments as Node[]) {
        if (carried.keys.size > 0 && isFunctionNode(arg)) {
          const inner = new Map(locals);
          for (const p of arg.params as Node[]) for (const n of patternNames(p)) inner.set(n, carried);
          visit(arg.body as Node, inner);
        } else {
          visit(arg, locals);
        }
      }
      return;
    }
    if (node.type === "JSXOpeningElement") {
      const element = jsxName(node.name as Node);
      for (const attr of node.attributes as Node[]) {
        if (attr.type === "JSXSpreadAttribute") {
          sinks.push({ element, prop: null, node: attr, taint: exprTaint(attr.argument as Node, env, locals) });
        } else if (attr.type === "JSXAttribute" && (attr.value as Node | null)?.type === "JSXExpressionContainer") {
          const prop = (attr.name as Node).name as string;
          const expression = (attr.value as Node).expression as Node;
          if (expression.type !== "JSXEmptyExpression") {
            sinks.push({ element, prop, node: attr, taint: exprTaint(expression, env, locals) });
          }
        }
      }
    }
    for (const child of childNodes(node)) visit(child, locals);
  };
  visit(fn.body as Node, new Map());
  return sinks;
}

/** functionTable: 이 파일에서 쓰는 FUNCTIONS 의 key → qualified key */
function analyzeComponent(def: ComponentDef, propState: PropState, functionTable: Map<string, string>) {
  const env: Env = { bindings: new Map(), queries: new Map(), propsIdent: null, propState };
  bindParams(def.fn, env);
  const declarators = ownedDeclarators(def.fn);

  for (const d of declarators) {
    if (!d.init || !isHookCall(d.init as Node)) continue;
    const call = unwrap(d.init as Node);
    const bare = isFunctionsMember(((call.arguments as Node[])[0] ?? call) as Node);
    const key = bare ? functionTable.get(bare) : undefined;
    if (!key) continue;
    const id = d.id as Node;
    if (id.type === "Identifier") env.queries.set(id.name as string, key);
    else if (id.type === "ObjectPattern") {
      for (const prop of id.properties as Node[]) {
        if (prop.type !== "ObjectProperty" || propertyName(prop.key as Node, false) !== "data") continue;
        for (const local of patternNames(prop.value as Node)) env.bindings.set(local, { keys: new Set([key]), direct: true });
      }
    }
  }

  // 선언 순서와 무관하게 수렴할 때까지 전파
  for (let round = 0, changed = true; changed && round < 32; round++) {
    changed = false;
    for (const d of declarators) {
      if (!d.init || isHookCall(d.init as Node)) continue;
      const t = exprTaint(d.init as Node, env);
      const id = d.id as Node;
      const assigned = id.type === "Identifier" ? t : undirect(t);
      for (const name of patternNames(id)) {
        const next = merge(env.bindings.get(name) ?? EMPTY, assigned);
        if (!sameTaint(env.bindings.get(name), next)) {
          env.bindings.set(name, next);
          changed = true;
        }
      }
    }
  }

  const ownKeys = new Set(env.queries.values());
  return { sinks: collectSinks(def.fn, env), ownKeys };
}

// ─── 위반 (추적 계약을 벗어난 모양) ─────────────────────────────────────────

function collectViolations(program: Node, file: string, functionIds: Map<string, string>): DataflowViolation[] {
  const violations: DataflowViolation[] = [];
  const allowedArgs = new Set<Node>();
  const declarationIds = new Set<Node>();

  walk(program, (node) => {
    if (node.type === "VariableDeclarator" && (node.id as Node).type === "Identifier" && (node.id as Node).name === FUNCTIONS_NAME) {
      declarationIds.add(node.id as Node);
    }
    if (node.type !== "CallExpression" || !isHookCall(node)) return;
    const arg = (node.arguments as Node[])[0];
    const key = arg ? isFunctionsMember(arg) : null;
    if (!arg || !key) {
      violations.push({
        rule: "hook-arg-not-functions",
        loc: locOf(file, node),
        message: `${HOOK_NAME} 의 첫 인자는 FUNCTIONS.<key> 여야 합니다`,
      });
      return;
    }
    allowedArgs.add(arg);
    if (!functionIds.has(key)) {
      violations.push({
        rule: "unknown-function-key",
        loc: locOf(file, arg),
        message: `FUNCTIONS 에 없는 key: ${key}`,
      });
    }
  });

  const visit = (node: Node, parent: Node | null) => {
    // `import { FUNCTIONS } from "@/modules/constants"` · `export { FUNCTIONS }` 는 값을 넘기는 게 아니라 이름을 잇는 것이다
    if (node.type === "ImportSpecifier" || node.type === "ImportDefaultSpecifier" || node.type === "ImportNamespaceSpecifier" || node.type === "ExportSpecifier") {
      return;
    }
    if (node.type === "MemberExpression" && (node.object as Node).type === "Identifier" && (node.object as Node).name === FUNCTIONS_NAME) {
      if (node.computed) {
        violations.push({ rule: "functions-dynamic-key", loc: locOf(file, node), message: "FUNCTIONS[...] 동적 접근은 추적할 수 없습니다" });
      } else if (!allowedArgs.has(node)) {
        const key = propertyName(node.property as Node, false);
        violations.push({
          rule: "functions-outside-hook",
          loc: locOf(file, node),
          message: `FUNCTIONS.${key} 는 ${HOOK_NAME}(FUNCTIONS.${key}, …) 의 첫 인자로만 씁니다`,
        });
      }
      return;
    }
    if (node.type === "Identifier" && node.name === FUNCTIONS_NAME && !declarationIds.has(node)) {
      const isMemberObject = parent?.type === "MemberExpression" && parent.object === node;
      if (!isMemberObject) {
        violations.push({ rule: "functions-escape", loc: locOf(file, node), message: "FUNCTIONS 전체를 넘기거나 대입하면 추적할 수 없습니다" });
      }
      return;
    }
    if (node.type === "StringLiteral" || node.type === "TemplateElement") {
      const text = node.type === "StringLiteral" ? (node.value as string) : ((node.value as { cooked: string }).cooked ?? "");
      if (text.includes("/ontology-functions/")) {
        violations.push({
          rule: "direct-run-call",
          loc: locOf(file, node),
          message: `OntologyFunction 을 직접 호출하지 말고 ${HOOK_NAME} 를 쓰세요`,
        });
      }
    }
    for (const child of childNodes(node)) visit(child, node);
  };
  visit(program, null);
  return violations;
}

// ─── 진입점 ───────────────────────────────────────────────────────────────────

// qualified key = `<FUNCTIONS 를 선언한 파일>\u0001<key>`
const QUALIFIER = "\u0001";
const bareKey = (qualified: string) => qualified.slice(qualified.lastIndexOf(QUALIFIER) + 1);

export interface ProjectFlow {
  /** 파일 → 그 파일의 분석 결과 (단일 파일 API 와 같은 모양) */
  files: Map<string, DataflowResult>;
  /** 파일 안의 JSX 엘리먼트 이름이 가리키는 컴포넌트 id (`파일#이름`). 프로젝트 밖 컴포넌트면 null */
  resolveElement(file: string, element: string): string | null;
}

export function analyzeProjectDataflow(project: AosProject): ProjectFlow {
  return project.memo("dataflow", () => computeProjectFlow(project));
}

/** 단일 파일 분석 — 파일 하나짜리 프로젝트로 돌린다 (기존 호출부·테스트 호환) */
export function analyzeDataflow(ast: Node, file: string): DataflowResult {
  const program = (ast.type === "File" ? ast.program : ast) as Node;
  return analyzeProjectDataflow(AosProject.fromProgram(file, program)).files.get(file)!;
}

function computeProjectFlow(project: AosProject): ProjectFlow {
  const programs = new Map<string, Node>();
  for (const file of project.files()) {
    const program = project.module(file)?.program;
    if (program) programs.set(file, program);
  }

  // 1. FUNCTIONS — 파일마다 "어느 파일의 선언을 쓰는가"
  const idOfQualified = new Map<string, string>();
  const declared = new Map<string, Map<string, string>>();
  for (const [file, program] of programs) {
    if (declaresFunctions(program)) declared.set(file, collectFunctionIds(program));
  }
  const functionsSourceOf = (file: string): string | null => {
    if (declared.has(file)) return file;
    const found = project.resolveName(file, FUNCTIONS_NAME);
    return typeof found === "object" && declared.has(found.file) ? found.file : null;
  };
  const tables = new Map<string, Map<string, string>>();
  const effectiveIds = new Map<string, Map<string, string>>();
  for (const file of programs.keys()) {
    const source = functionsSourceOf(file);
    const ids = source ? declared.get(source)! : new Map<string, string>();
    const table = new Map<string, string>();
    for (const [key, id] of ids) {
      const qualified = `${source}${QUALIFIER}${key}`;
      idOfQualified.set(qualified, id);
      table.set(key, qualified);
    }
    tables.set(file, table);
    effectiveIds.set(file, ids);
  }

  // 2. 컴포넌트 — `파일#이름`
  const defs = new Map<string, { file: string; def: ComponentDef }>();
  const localDefs = new Map<string, Map<string, string>>();
  const byName = new Map<string, string[]>();
  for (const [file, program] of programs) {
    const local = new Map<string, string>();
    for (const def of collectComponents(program)) {
      const id = `${file}#${def.name}`;
      defs.set(id, { file, def });
      local.set(def.name, id);
      byName.set(def.name, [...(byName.get(def.name) ?? []), id]);
    }
    localDefs.set(file, local);
  }

  const resolved = new Map<string, string | null>();
  const resolveElement = (file: string, element: string): string | null => {
    const cacheKey = `${file}\n${element}`;
    if (resolved.has(cacheKey)) return resolved.get(cacheKey)!;
    let target: string | null = null;
    if (!element.includes(".")) {
      target = localDefs.get(file)?.get(element) ?? null;
      if (!target) {
        const found = project.resolveName(file, element);
        if (typeof found === "object") {
          const id = `${found.file}#${found.local}`;
          target = defs.has(id) ? id : uniqueByName(element);
        } else if (found !== "external") {
          // import 를 끝까지 못 따라갔거나(missing) 바인딩이 없으면(unbound) 이름이 하나뿐일 때만 잇는다
          target = uniqueByName(element);
        }
      }
    }
    resolved.set(cacheKey, target);
    return target;
  };
  function uniqueByName(name: string): string | null {
    const candidates = byName.get(name) ?? [];
    return candidates.length === 1 ? candidates[0] : null;
  }

  // 3. 컴포넌트 간(파일 경계 포함) prop 전달을 따라 수렴할 때까지
  const states = new Map<string, PropState>([...defs.keys()].map((id) => [id, { props: new Map(), spread: EMPTY }]));
  const results = new Map<string, ReturnType<typeof analyzeComponent>>();
  for (let round = 0, changed = true; changed && round < 64; round++) {
    changed = false;
    for (const [id, { file, def }] of defs) {
      const result = analyzeComponent(def, states.get(id)!, tables.get(file)!);
      results.set(id, result);
      for (const sink of result.sinks) {
        if (sink.taint.keys.size === 0) continue;
        const targetId = resolveElement(file, sink.element);
        const target = targetId ? states.get(targetId) : undefined;
        if (!target) continue;
        if (sink.prop === null) {
          const next = merge(target.spread, sink.taint);
          if (!sameTaint(target.spread, next)) {
            target.spread = next;
            changed = true;
          }
        } else {
          const next = merge(target.props.get(sink.prop) ?? EMPTY, sink.taint);
          if (!sameTaint(target.props.get(sink.prop), next)) {
            target.props.set(sink.prop, next);
            changed = true;
          }
        }
      }
    }
  }

  const keysOf = (keys: Iterable<string>) => [...new Set([...keys].map(bareKey))].sort();
  const idsOf = (keys: Iterable<string>) => {
    const ordered = [...keys].sort((a, b) => bareKey(a).localeCompare(bareKey(b)) || a.localeCompare(b));
    const ids: string[] = [];
    for (const qualified of ordered) {
      const id = idOfQualified.get(qualified);
      if (id && !ids.includes(id)) ids.push(id);
    }
    return ids;
  };

  // 4. 파일별 결과
  const files = new Map<string, DataflowResult>();
  for (const [file, program] of programs) {
    const components: ComponentFlow[] = [...localDefs.get(file)!.values()].map((id) => {
      const { def } = defs.get(id)!;
      const result = results.get(id)!;
      const state = states.get(id)!;
      const keys = new Set(result.ownKeys);
      for (const t of [...state.props.values(), state.spread]) for (const k of t.keys) keys.add(k);
      return {
        id,
        name: def.name,
        start: def.fn.start,
        end: def.fn.end,
        functionKeys: keysOf(keys),
        functionIds: idsOf(keys),
        // 위젯 판정에 쓰는 것은 컴포넌트(대문자)로 들어가는 데이터 prop 이다. host 엘리먼트 속성
        // (`button.disabled`, `span.className`)과 React `key` 는 데이터가 아니라 기록하지 않는다.
        bindings: result.sinks
          .filter((s) => s.taint.keys.size > 0 && s.prop !== null && s.prop !== "key" && isPascalCase(s.element))
          .map((s) => ({
            element: s.element,
            prop: s.prop as string,
            loc: locOf(file, s.node),
            functionKeys: keysOf(s.taint.keys),
            functionIds: idsOf(s.taint.keys),
            direct: s.taint.direct,
          })),
      };
    });

    let usesHook = false;
    walk(program, (node) => {
      if (node.type === "CallExpression" && isHookCall(node)) usesHook = true;
    });

    const functionIds = effectiveIds.get(file)!;
    const violations = definesHook(program) ? [] : collectViolations(program, file, functionIds);
    files.set(file, { functionIds, components, violations, usesHook });
  }

  return { files, resolveElement };
}
