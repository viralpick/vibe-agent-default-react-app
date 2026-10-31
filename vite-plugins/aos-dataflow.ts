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
//
// 액션 (AOS-7001): `useOntologyAction(ACTIONS.k)` 결과도 같은 엔진을 두 번째 key 공간으로 돌려 추적한다.
// 결과 객체 전체와 `execute` 가 k 를 운반하고 `status` / `isRunning` / `data` / `error` 는 운반하지 않는다.
// 액션 위반은 actionViolations 로 따로 싣는다 — 기존 앱의 `/execute` 직접 호출이 함수 위반(violations)을
// 보는 소비자를 깨지 않게.

export const HOOK_NAME = "useOntologyFunction";
/** 템플릿이 제공하는 hook 모듈 — `/ontology-functions/{id}/run` 을 직접 부를 수 있는 유일한 자리 */
export const HOOK_FILE = "src/hooks/useOntologyFunction.ts";
const FUNCTIONS_NAME = "FUNCTIONS";
// hook 결과에서 함수 데이터를 운반하지 않는 필드
const CLEAN_RESULT_FIELDS = new Set(["isLoading", "error", "refetch"]);

export const ACTION_HOOK_NAME = "useOntologyAction";
/** 템플릿이 제공하는 액션 hook 모듈 — `/ontology-actions/` 를 직접 부를 수 있는 유일한 자리 */
export const ACTION_HOOK_FILE = "src/hooks/useOntologyAction.ts";
export const ACTIONS_NAME = "ACTIONS";
// 액션 hook 결과에서 액션을 운반하지 않는 필드 — 실행 중 표시를 넘겨받은 컴포넌트가 액션을 쓰는 것으로 오염되지 않게
const CLEAN_ACTION_RESULT_FIELDS = new Set(["status", "isRunning", "data", "error"]);
// 액션 hook 결과를 spread 로 받았을 때 액션을 운반하는 prop — children 같은 다른 prop 은 결과에서 온 것이 아니다
const SPREAD_ACTION_RESULT_FIELDS = new Set(["execute"]);

type RuleName = DataflowViolation["rule"];

interface KeySpace {
  hook: string;
  hookFile: string;
  constants: string;
  /** 이 이름의 결과 필드만 direct 로 운반한다 (함수의 data) */
  directField: string | null;
  cleanFields: Set<string>;
  /** 핸들을 spread 로 받았을 때 핸들을 운반하는 prop (handleResult 일 때만) */
  spreadFields: Set<string>;
  /**
   * hook 결과를 핸들로 보는가 (액션). 결과 전체와 그 별칭·prop 은 핸들(direct)로 운반되고, 핸들에서 꺼낸 필드는
   * 어디서든 cleanFields 를 빼고 운반한다. 핸들을 받기만 하고 운반 필드를 꺼내지 않은 컴포넌트는 쓰는 것으로 세지 않는다
   */
  handleResult: boolean;
  target: string;
  directPath: string;
  rules: {
    hookArg: RuleName;
    unknownKey: RuleName;
    dynamicKey: RuleName;
    outside: RuleName;
    escape: RuleName;
    directCall: RuleName;
    redefined: RuleName;
  };
}

const FUNCTION_SPACE: KeySpace = {
  hook: HOOK_NAME,
  hookFile: HOOK_FILE,
  constants: FUNCTIONS_NAME,
  directField: "data",
  cleanFields: CLEAN_RESULT_FIELDS,
  spreadFields: new Set(),
  handleResult: false,
  target: "OntologyFunction",
  directPath: "/ontology-functions/",
  rules: {
    hookArg: "hook-arg-not-functions",
    unknownKey: "unknown-function-key",
    dynamicKey: "functions-dynamic-key",
    outside: "functions-outside-hook",
    escape: "functions-escape",
    directCall: "direct-run-call",
    redefined: "hook-redefined",
  },
};

const ACTION_SPACE: KeySpace = {
  hook: ACTION_HOOK_NAME,
  hookFile: ACTION_HOOK_FILE,
  constants: ACTIONS_NAME,
  directField: null,
  cleanFields: CLEAN_ACTION_RESULT_FIELDS,
  spreadFields: SPREAD_ACTION_RESULT_FIELDS,
  handleResult: true,
  target: "OntologyAction",
  directPath: "/ontology-actions/",
  rules: {
    hookArg: "hook-arg-not-actions",
    unknownKey: "unknown-action-key",
    dynamicKey: "actions-dynamic-key",
    outside: "actions-outside-hook",
    escape: "actions-escape",
    directCall: "direct-action-call",
    redefined: "action-hook-redefined",
  },
};

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
    | "direct-run-call"
    | "hook-redefined"
    | "hook-arg-not-actions"
    | "unknown-action-key"
    | "actions-dynamic-key"
    | "actions-outside-hook"
    | "actions-escape"
    | "direct-action-call"
    | "action-hook-redefined";
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
  /** 이 컴포넌트가 실행하는 ACTIONS 의 key (직접 부르거나 prop 으로 받은 execute) */
  actionKeys: string[];
  actionIds: string[];
  bindings: DataBinding[];
}

export interface DataflowResult {
  /** 이 파일이 쓰는 FUNCTIONS 상수(자기 선언 또는 import 한 선언)의 key → OntologyFunction UUID */
  functionIds: Map<string, string>;
  components: ComponentFlow[];
  violations: DataflowViolation[];
  /** 파일이 hook 을 한 번이라도 쓰는가 (기존 앱 = Promise.all 패턴 판별용) */
  usesHook: boolean;
  /** 이 파일이 쓰는 ACTIONS 상수의 key → OntologyAction UUID */
  actionIds: Map<string, string>;
  /** 액션 추적 계약(useOntologyAction)을 벗어난 위치 — violations 와 따로 둔다 */
  actionViolations: DataflowViolation[];
  usesActionHook: boolean;
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

function constantMember(node: Node, constants: string): string | null {
  if (node.type !== "MemberExpression" || node.computed) return null;
  const object = node.object as Node;
  if (object.type !== "Identifier" || object.name !== constants) return null;
  return propertyName(node.property as Node, false);
}

export function isFunctionsMember(node: Node): string | null {
  return constantMember(node, FUNCTIONS_NAME);
}

function isCallOf(node: Node, hook: string): boolean {
  const call = unwrap(node);
  return (
    call.type === "CallExpression" &&
    (call.callee as Node).type === "Identifier" &&
    (call.callee as Node).name === hook
  );
}

export function isHookCall(node: Node): boolean {
  return isCallOf(node, HOOK_NAME);
}

// ─── 수집: FUNCTIONS · ACTIONS 상수, top-level 컴포넌트 ───────────────────────

function collectConstantIds(program: Node, constants: string): Map<string, string> {
  const ids = new Map<string, string>();
  walk(program, (node) => {
    if (node.type !== "VariableDeclarator") return;
    const id = node.id as Node;
    if (id.type !== "Identifier" || id.name !== constants || !node.init) return;
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
 * 이 모듈이 top-level 에 `useOntologyFunction` 을 선언했으면 그 선언. 템플릿 hook 모듈(HOOK_FILE)만 그래도 되고,
 * 그 모듈은 `/ontology-functions/{id}/run` 을 부르는 유일하게 허용된 자리라 위반을 보지 않는다.
 *
 * 이름만으로 면제하면 안 된다 — 앱 코드에 같은 이름의 함수를 두기만 해도 그 파일의 위반 검사가 통째로
 * 꺼지고, 그 가짜 hook 호출이 추적에 집계된다. 그래서 다른 파일의 선언은 `hook-redefined` 위반이다.
 */
function hookDeclaration(program: Node, hook: string): Node | null {
  for (const stmt of program.body as Node[]) {
    const decl = (stmt.type === "ExportNamedDeclaration" ? stmt.declaration : stmt) as Node | null;
    if (!decl) continue;
    if (decl.type === "FunctionDeclaration" && (decl.id as Node | null)?.name === hook) return decl;
    if (decl.type === "VariableDeclaration") {
      const found = (decl.declarations as Node[]).find(
        (d) => (d.id as Node).type === "Identifier" && (d.id as Node).name === hook,
      );
      if (found) return found;
    }
  }
  return null;
}

function declaresConstant(program: Node, constants: string): boolean {
  let found = false;
  walk(program, (node) => {
    if (node.type === "VariableDeclarator" && (node.id as Node).type === "Identifier" && (node.id as Node).name === constants) found = true;
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
  space: KeySpace;
  bindings: Map<string, Taint>;
  /** `const brand = useOntologyFunction(FUNCTIONS.k)` → brand → k */
  queries: Map<string, string>;
  /** `function C(props)` 의 props 식별자 */
  propsIdent: string | null;
  propState: PropState;
}

/** spread 로 받은 핸들에서 prop 하나를 꺼낸 값 — 핸들을 운반하는 prop 이 아니면 없음 */
function spreadField(state: PropState, prop: string, space: KeySpace): Taint {
  if (!space.handleResult || !isHandle(state.spread)) return state.spread;
  return space.spreadFields.has(prop) ? undirect(state.spread) : EMPTY;
}

function propTaint(state: PropState, prop: string, space: KeySpace): Taint {
  return merge(state.props.get(prop) ?? EMPTY, spreadField(state, prop, space));
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

/** 핸들 공간에서 direct 는 "hook 결과 전체를 그대로 가리킨다" 는 뜻이다 */
function isHandle(t: Taint): boolean {
  return t.direct && t.keys.size > 0;
}

/** 핸들을 구조 분해 — 운반하지 않는 필드는 빼고, 나머지 필드는 핸들이 아닌 값으로, rest 는 핸들로 */
function handleFields(pattern: Node, handle: Taint, cleanFields: Set<string>): [string, Taint][] {
  const pairs: [string, Taint][] = [];
  for (const prop of pattern.properties as Node[]) {
    if (prop.type === "RestElement") {
      for (const name of patternNames(prop)) pairs.push([name, handle]);
      continue;
    }
    if (prop.type !== "ObjectProperty") continue;
    const field = propertyName(prop.key as Node, prop.computed as boolean);
    if (field !== null && cleanFields.has(field)) continue;
    for (const name of patternNames(prop.value as Node)) pairs.push([name, undirect(handle)]);
  }
  return pairs;
}

/** 멤버 접근의 대상이 핸들이면 그 핸들 — `approve` · `alias` · `action`(prop) · `props.action` */
function handleOf(object: Node, env: Env, locals: Map<string, Taint> = new Map()): Taint | null {
  const target = unwrap(object);
  let t: Taint | null = null;
  if (target.type === "Identifier") {
    const name = target.name as string;
    if (locals.has(name)) t = locals.get(name)!;
    else if (env.queries.has(name)) t = { keys: new Set([env.queries.get(name)!]), direct: true };
    else if (env.propsIdent !== name) t = env.bindings.get(name) ?? null;
  } else if ((target.type === "MemberExpression" || target.type === "OptionalMemberExpression") && !target.computed) {
    const base = unwrap(target.object as Node);
    const prop = propertyName(target.property as Node, false);
    if (base.type === "Identifier" && base.name === env.propsIdent && !locals.has(base.name as string) && prop) {
      t = propTaint(env.propState, prop, env.space);
    }
  }
  return t && isHandle(t) ? t : null;
}

/** 식이 운반하는 taint. direct 는 식이 별칭 형태(식별자·멤버 접근)일 때만 유지된다 */
function exprTaint(expr: Node, env: Env, locals: Map<string, Taint> = new Map()): Taint {
  let acc: Taint = EMPTY;
  const add = (t: Taint) => {
    acc = merge(acc, t);
  };
  const lookup = (name: string): Taint | null => {
    if (locals.has(name)) return locals.get(name)!;
    if (env.queries.has(name)) return { keys: new Set([env.queries.get(name)!]), direct: env.space.handleResult };
    if (env.propsIdent === name) return allPropsTaint(env.propState);
    return env.bindings.get(name) ?? null;
  };

  const visit = (node: Node) => {
    if (node.type === "MemberExpression" || node.type === "OptionalMemberExpression") {
      const object = unwrap(node.object as Node);
      const handle = env.space.handleResult ? handleOf(object, env, locals) : null;
      if (handle) {
        const prop = propertyName(node.property as Node, node.computed as boolean);
        if (!(prop && env.space.cleanFields.has(prop))) add(undirect(handle));
        return;
      }
      if (object.type === "Identifier") {
        const base = object.name as string;
        const prop = propertyName(node.property as Node, node.computed as boolean);
        if (!locals.has(base) && env.queries.has(base)) {
          if (prop !== null && prop === env.space.directField) add({ keys: new Set([env.queries.get(base)!]), direct: true });
          else if (!(prop && env.space.cleanFields.has(prop))) add({ keys: new Set([env.queries.get(base)!]), direct: false });
          return;
        }
        if (!locals.has(base) && env.propsIdent === base && prop) {
          add(propTaint(env.propState, prop, env.space));
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
      env.bindings.set(local, propTaint(env.propState, key, env.space));
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

/** table: 이 파일에서 쓰는 상수(FUNCTIONS · ACTIONS)의 key → qualified key */
function analyzeComponent(def: ComponentDef, propState: PropState, table: Map<string, string>, space: KeySpace) {
  const env: Env = { space, bindings: new Map(), queries: new Map(), propsIdent: null, propState };
  bindParams(def.fn, env);
  const declarators = ownedDeclarators(def.fn);
  const isSpaceHook = (node: Node) => isCallOf(node, space.hook);
  const ownKeys = new Set<string>();

  for (const d of declarators) {
    if (!d.init || !isSpaceHook(d.init as Node)) continue;
    const call = unwrap(d.init as Node);
    const bare = constantMember(((call.arguments as Node[])[0] ?? call) as Node, space.constants);
    const key = bare ? table.get(bare) : undefined;
    if (!key) continue;
    const id = d.id as Node;
    if (id.type === "Identifier") {
      env.queries.set(id.name as string, key);
      ownKeys.add(key);
    } else if (id.type === "ObjectPattern" && space.handleResult) {
      ownKeys.add(key);
      for (const [local, t] of handleFields(id, { keys: new Set([key]), direct: true }, space.cleanFields)) env.bindings.set(local, t);
    } else if (id.type === "ObjectPattern") {
      for (const prop of id.properties as Node[]) {
        if (prop.type !== "ObjectProperty" || propertyName(prop.key as Node, false) !== space.directField) continue;
        for (const local of patternNames(prop.value as Node)) env.bindings.set(local, { keys: new Set([key]), direct: true });
      }
    }
  }

  // 선언 순서와 무관하게 수렴할 때까지 전파
  for (let round = 0, changed = true; changed && round < 32; round++) {
    changed = false;
    for (const d of declarators) {
      if (!d.init || isSpaceHook(d.init as Node)) continue;
      const t = exprTaint(d.init as Node, env);
      const id = d.id as Node;
      const assigned = id.type === "Identifier" ? t : undirect(t);
      const fromHandle = space.handleResult && id.type === "ObjectPattern" && isHandle(t);
      const pairs: [string, Taint][] = fromHandle
        ? handleFields(id, t, space.cleanFields)
        : patternNames(id).map((name) => [name, assigned]);
      // 핸들에서 운반 필드를 구조 분해로 꺼낸 것도 쓰는 것이다
      if (fromHandle && pairs.some(([, value]) => !isHandle(value))) for (const k of t.keys) ownKeys.add(k);
      for (const [name, value] of pairs) {
        const next = merge(env.bindings.get(name) ?? EMPTY, value);
        if (!sameTaint(env.bindings.get(name), next)) {
          env.bindings.set(name, next);
          changed = true;
        }
      }
    }
  }

  if (space.handleResult) for (const k of handleUses(def.fn, env)) ownKeys.add(k);
  return { sinks: collectSinks(def.fn, env), ownKeys };
}

/**
 * 컴포넌트가 핸들의 운반 필드를 꺼낸 곳의 key — `action.execute()`, `props.action.execute`, 그리고 핸들을 spread 로
 * 받았을 때 `({ execute })` · `props.execute`
 */
function handleUses(fn: Node, env: Env): Set<string> {
  const used = new Set<string>();
  const carried = (prop: string | null) => !(prop && env.space.cleanFields.has(prop));
  const spread = env.propState.spread;
  const fromSpread = (prop: string | null) => isHandle(spread) && prop !== null && env.space.spreadFields.has(prop);
  const useSpread = () => {
    for (const k of spread.keys) used.add(k);
  };
  if (isHandle(spread)) {
    const first = (fn.params as Node[])[0];
    const param = first?.type === "AssignmentPattern" ? (first.left as Node) : first;
    if (param?.type === "ObjectPattern") {
      for (const prop of param.properties as Node[]) {
        if (prop.type === "ObjectProperty" && fromSpread(propertyName(prop.key as Node, prop.computed as boolean))) useSpread();
      }
    }
  }
  walk(fn.body as Node, (node) => {
    if (node.type !== "MemberExpression" && node.type !== "OptionalMemberExpression") return;
    const prop = propertyName(node.property as Node, node.computed as boolean);
    if (!carried(prop)) return;
    const object = unwrap(node.object as Node);
    if (fromSpread(prop) && object.type === "Identifier" && object.name === env.propsIdent) {
      useSpread();
      return;
    }
    const handle = handleOf(object, env);
    if (handle) for (const k of handle.keys) used.add(k);
  });
  return used;
}

// ─── 위반 (추적 계약을 벗어난 모양) ─────────────────────────────────────────

function collectViolations(program: Node, file: string, ids: Map<string, string>, space: KeySpace): DataflowViolation[] {
  const violations: DataflowViolation[] = [];
  const allowedArgs = new Set<Node>();
  const declarationIds = new Set<Node>();
  const { constants, hook, rules } = space;

  walk(program, (node) => {
    if (node.type === "VariableDeclarator" && (node.id as Node).type === "Identifier" && (node.id as Node).name === constants) {
      declarationIds.add(node.id as Node);
    }
    if (node.type !== "CallExpression" || !isCallOf(node, hook)) return;
    const arg = (node.arguments as Node[])[0];
    const key = arg ? constantMember(arg, constants) : null;
    if (!arg || !key) {
      violations.push({
        rule: rules.hookArg,
        loc: locOf(file, node),
        message: `${hook} 의 첫 인자는 ${constants}.<key> 여야 합니다`,
      });
      return;
    }
    allowedArgs.add(arg);
    if (!ids.has(key)) {
      violations.push({
        rule: rules.unknownKey,
        loc: locOf(file, arg),
        message: `${constants} 에 없는 key: ${key}`,
      });
    }
  });

  const visit = (node: Node, parent: Node | null) => {
    // `import { FUNCTIONS } from "@/modules/constants"` · `export { FUNCTIONS }` 는 값을 넘기는 게 아니라 이름을 잇는 것이다
    if (node.type === "ImportSpecifier" || node.type === "ImportDefaultSpecifier" || node.type === "ImportNamespaceSpecifier" || node.type === "ExportSpecifier") {
      return;
    }
    if (node.type === "MemberExpression" && (node.object as Node).type === "Identifier" && (node.object as Node).name === constants) {
      if (node.computed) {
        violations.push({ rule: rules.dynamicKey, loc: locOf(file, node), message: `${constants}[...] 동적 접근은 추적할 수 없습니다` });
      } else if (!allowedArgs.has(node)) {
        const key = propertyName(node.property as Node, false);
        violations.push({
          rule: rules.outside,
          loc: locOf(file, node),
          message: `${constants}.${key} 는 ${hook}(${constants}.${key}, …) 의 첫 인자로만 씁니다`,
        });
      }
      return;
    }
    if (node.type === "Identifier" && node.name === constants && !declarationIds.has(node)) {
      const isMemberObject = parent?.type === "MemberExpression" && parent.object === node;
      if (!isMemberObject) {
        violations.push({ rule: rules.escape, loc: locOf(file, node), message: `${constants} 전체를 넘기거나 대입하면 추적할 수 없습니다` });
      }
      return;
    }
    if (node.type === "StringLiteral" || node.type === "TemplateElement") {
      const text = node.type === "StringLiteral" ? (node.value as string) : ((node.value as { cooked: string }).cooked ?? "");
      if (text.includes(space.directPath)) {
        violations.push({
          rule: rules.directCall,
          loc: locOf(file, node),
          message: `${space.target} 을 직접 호출하지 말고 ${hook} 를 쓰세요`,
        });
      }
    }
    for (const child of childNodes(node)) visit(child, node);
  };
  visit(program, null);
  return violations;
}

/** 템플릿 hook 파일은 면제, 다른 파일이 hook 을 새로 만들면 위반이다 */
function spaceViolations(program: Node, file: string, ids: Map<string, string>, space: KeySpace): { violations: DataflowViolation[]; redefined: boolean } {
  if (file === space.hookFile) return { violations: [], redefined: false };
  const violations = collectViolations(program, file, ids, space);
  const redefined = hookDeclaration(program, space.hook);
  if (redefined) {
    violations.push({
      rule: space.rules.redefined,
      loc: locOf(file, redefined),
      message: `${space.hook} 는 템플릿(${space.hookFile})이 제공합니다 — 같은 이름으로 새로 만들지 말고 import 해서 쓰세요`,
    });
  }
  return { violations, redefined: redefined !== null };
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
  /** 패키지에서 import 한 엘리먼트인가 (`@enhans/synapse` 의 Card 등) — 이름이 같아도 앱 컴포넌트가 아니다 */
  isForeignElement(file: string, element: string): boolean;
}

export function analyzeProjectDataflow(project: AosProject): ProjectFlow {
  return project.memo("dataflow", () => computeProjectFlow(project));
}

/** 단일 파일 분석 — 파일 하나짜리 프로젝트로 돌린다 (기존 호출부·테스트 호환) */
export function analyzeDataflow(ast: Node, file: string): DataflowResult {
  const program = (ast.type === "File" ? ast.program : ast) as Node;
  return analyzeProjectDataflow(AosProject.fromProgram(file, program)).files.get(file)!;
}

interface SpaceTables {
  /** 파일 → 그 파일에서 쓰는 상수의 key → qualified key */
  tables: Map<string, Map<string, string>>;
  /** 파일 → 그 파일에서 쓰는 상수의 key → UUID */
  effectiveIds: Map<string, Map<string, string>>;
  idOfQualified: Map<string, string>;
}

/** 파일마다 "어느 파일의 상수 선언을 쓰는가" — 자기 선언, 없으면 import 한 모듈의 선언 */
function spaceTables(project: AosProject, programs: Map<string, Node>, space: KeySpace): SpaceTables {
  const idOfQualified = new Map<string, string>();
  const declared = new Map<string, Map<string, string>>();
  for (const [file, program] of programs) {
    if (declaresConstant(program, space.constants)) declared.set(file, collectConstantIds(program, space.constants));
  }
  const sourceOf = (file: string): string | null => {
    if (declared.has(file)) return file;
    const found = project.resolveName(file, space.constants);
    return typeof found === "object" && declared.has(found.file) ? found.file : null;
  };
  const tables = new Map<string, Map<string, string>>();
  const effectiveIds = new Map<string, Map<string, string>>();
  for (const file of programs.keys()) {
    const source = sourceOf(file);
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
  return { tables, effectiveIds, idOfQualified };
}

function computeProjectFlow(project: AosProject): ProjectFlow {
  const programs = new Map<string, Node>();
  for (const file of project.files()) {
    const program = project.module(file)?.program;
    if (program) programs.set(file, program);
  }

  // 1. FUNCTIONS · ACTIONS — 파일마다 "어느 파일의 선언을 쓰는가"
  const functionSpace = spaceTables(project, programs, FUNCTION_SPACE);
  const actionSpace = spaceTables(project, programs, ACTION_SPACE);

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
          // 파일까지 풀렸는데 그 파일에서 컴포넌트로 인식하지 못했으면(익명 default export 등) 잇지 않는다.
          // 이름으로 다른 파일의 컴포넌트에 이으면 틀린 data-aos-functions 가 들어간다.
          const id = `${found.file}#${found.local}`;
          target = defs.has(id) ? id : null;
        } else if (found === "missing") {
          // import 를 끝까지 못 따라갔을 때만 이름이 하나뿐인 컴포넌트에 잇는다. 바인딩이 없으면(unbound —
          // 함수 안 지역 컴포넌트 등) 다른 파일의 같은 이름이 아니다.
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

  // 3. 컴포넌트 간(파일 경계 포함) prop 전달을 따라 수렴할 때까지 — key 공간마다 따로
  const propagate = (space: KeySpace, { tables }: SpaceTables) => {
    const states = new Map<string, PropState>([...defs.keys()].map((id) => [id, { props: new Map(), spread: EMPTY }]));
    const results = new Map<string, ReturnType<typeof analyzeComponent>>();
    for (let round = 0, changed = true; changed && round < 64; round++) {
      changed = false;
      for (const [id, { file, def }] of defs) {
        const result = analyzeComponent(def, states.get(id)!, tables.get(file)!, space);
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
    /** 컴포넌트가 직접 부른 hook 의 key + prop 으로 받은 key (핸들은 꺼내 쓴 것만 — ownKeys 에 들어 있다) */
    const keysOfComponent = (id: string) => {
      const state = states.get(id)!;
      const keys = new Set(results.get(id)!.ownKeys);
      for (const t of [...state.props.values(), state.spread]) {
        if (space.handleResult && isHandle(t)) continue;
        for (const k of t.keys) keys.add(k);
      }
      return keys;
    };
    return { results, keysOfComponent };
  };
  const functionFlow = propagate(FUNCTION_SPACE, functionSpace);
  const actionFlow = propagate(ACTION_SPACE, actionSpace);

  const keysOf = (keys: Iterable<string>) => [...new Set([...keys].map(bareKey))].sort();
  const idsOf = (keys: Iterable<string>, idOfQualified: Map<string, string>) => {
    const ordered = [...keys].sort((a, b) => bareKey(a).localeCompare(bareKey(b)) || a.localeCompare(b));
    const ids: string[] = [];
    for (const qualified of ordered) {
      const id = idOfQualified.get(qualified);
      if (id && !ids.includes(id)) ids.push(id);
    }
    return ids;
  };
  const functionIdsOf = (keys: Iterable<string>) => idsOf(keys, functionSpace.idOfQualified);

  // 4. 파일별 결과
  const files = new Map<string, DataflowResult>();
  for (const [file, program] of programs) {
    const components: ComponentFlow[] = [...localDefs.get(file)!.values()].map((id) => {
      const { def } = defs.get(id)!;
      const result = functionFlow.results.get(id)!;
      const keys = functionFlow.keysOfComponent(id);
      const actionKeys = actionFlow.keysOfComponent(id);
      return {
        id,
        name: def.name,
        start: def.fn.start,
        end: def.fn.end,
        functionKeys: keysOf(keys),
        functionIds: functionIdsOf(keys),
        actionKeys: keysOf(actionKeys),
        actionIds: idsOf(actionKeys, actionSpace.idOfQualified),
        // 위젯 판정에 쓰는 것은 컴포넌트(대문자)로 들어가는 데이터 prop 이다. host 엘리먼트 속성
        // (`button.disabled`, `span.className`)과 React `key` 는 데이터가 아니라 기록하지 않는다.
        bindings: result.sinks
          .filter((s) => s.taint.keys.size > 0 && s.prop !== null && s.prop !== "key" && isPascalCase(s.element))
          .map((s) => ({
            element: s.element,
            prop: s.prop as string,
            loc: locOf(file, s.node),
            functionKeys: keysOf(s.taint.keys),
            functionIds: functionIdsOf(s.taint.keys),
            direct: s.taint.direct,
          })),
      };
    });

    let usesHook = false;
    let usesActionHook = false;
    walk(program, (node) => {
      if (node.type !== "CallExpression") return;
      if (isCallOf(node, HOOK_NAME)) usesHook = true;
      if (isCallOf(node, ACTION_HOOK_NAME)) usesActionHook = true;
    });

    const functionIds = functionSpace.effectiveIds.get(file)!;
    const actionIds = actionSpace.effectiveIds.get(file)!;
    const functionCheck = spaceViolations(program, file, functionIds, FUNCTION_SPACE);
    const actionCheck = spaceViolations(program, file, actionIds, ACTION_SPACE);
    // hook 을 새로 만든 파일은 hook 계약 안의 파일이다 — 예전 앱 예외(usesHook=false)로 위반이 묻히지 않게.
    files.set(file, {
      functionIds,
      components,
      violations: functionCheck.violations,
      usesHook: usesHook || functionCheck.redefined,
      actionIds,
      actionViolations: actionCheck.violations,
      usesActionHook: usesActionHook || actionCheck.redefined,
    });
  }

  const isForeignElement = (file: string, element: string): boolean =>
    !element.includes(".") && !localDefs.get(file)?.has(element) && project.resolveName(file, element) === "external";

  return { files, resolveElement, isForeignElement };
}
