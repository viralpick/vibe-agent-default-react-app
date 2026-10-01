import { childNodes, isFunctionNode, isNode, isPascalCase, locOf, type Node, unwrap, walk } from "./aos-ast";

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
  name: string;
  start: number;
  end: number;
  functionKeys: string[];
  bindings: DataBinding[];
}

export interface DataflowResult {
  /** FUNCTIONS 상수의 key → OntologyFunction UUID */
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

function propertyName(node: Node, computed: boolean): string | null {
  if (!computed && node.type === "Identifier") return node.name as string;
  if (node.type === "StringLiteral") return node.value as string;
  return null;
}

function patternNames(pattern: Node | null | undefined): string[] {
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

function isFunctionsMember(node: Node): string | null {
  if (node.type !== "MemberExpression" || node.computed) return null;
  const object = node.object as Node;
  if (object.type !== "Identifier" || object.name !== FUNCTIONS_NAME) return null;
  return propertyName(node.property as Node, false);
}

function isHookCall(node: Node): boolean {
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

interface ComponentDef {
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

function collectComponents(program: Node): ComponentDef[] {
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
  const target = unwrap(expr);
  const aliasForm = target.type === "Identifier" || target.type === "MemberExpression" || target.type === "OptionalMemberExpression";
  return aliasForm ? acc : undirect(acc);
}

/** 컴포넌트 함수 자신이 소유한 변수 선언 (중첩 함수 안의 선언은 제외) */
function ownedDeclarators(fn: Node): Node[] {
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

function analyzeComponent(def: ComponentDef, propState: PropState, functionIds: Map<string, string>) {
  const env: Env = { bindings: new Map(), queries: new Map(), propsIdent: null, propState };
  bindParams(def.fn, env);
  const declarators = ownedDeclarators(def.fn);

  for (const d of declarators) {
    if (!d.init || !isHookCall(d.init as Node)) continue;
    const call = unwrap(d.init as Node);
    const key = isFunctionsMember(((call.arguments as Node[])[0] ?? call) as Node);
    if (!key || !functionIds.has(key)) continue;
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

export function analyzeDataflow(ast: Node, file: string): DataflowResult {
  const program = (ast.type === "File" ? ast.program : ast) as Node;
  const functionIds = collectFunctionIds(program);
  const defs = collectComponents(program);
  const byName = new Map(defs.map((d) => [d.name, d]));
  const states = new Map<string, PropState>(defs.map((d) => [d.name, { props: new Map(), spread: EMPTY }]));
  const results = new Map<string, ReturnType<typeof analyzeComponent>>();

  // 컴포넌트 간 prop 전달을 따라 수렴할 때까지
  for (let round = 0, changed = true; changed && round < 32; round++) {
    changed = false;
    for (const def of defs) {
      const result = analyzeComponent(def, states.get(def.name)!, functionIds);
      results.set(def.name, result);
      for (const sink of result.sinks) {
        const target = states.get(sink.element);
        if (!target || !byName.has(sink.element) || sink.taint.keys.size === 0) continue;
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

  const components: ComponentFlow[] = defs.map((def) => {
    const result = results.get(def.name)!;
    const state = states.get(def.name)!;
    const keys = new Set(result.ownKeys);
    for (const t of [...state.props.values(), state.spread]) for (const k of t.keys) keys.add(k);
    return {
      name: def.name,
      start: def.fn.start,
      end: def.fn.end,
      functionKeys: [...keys].sort(),
      bindings: result.sinks
        .filter((s) => s.taint.keys.size > 0 && s.prop !== null)
        .map((s) => ({
          element: s.element,
          prop: s.prop as string,
          loc: locOf(file, s.node),
          functionKeys: [...s.taint.keys].sort(),
          direct: s.taint.direct,
        })),
    };
  });

  let usesHook = false;
  walk(program, (node) => {
    if (node.type === "CallExpression" && isHookCall(node)) usesHook = true;
  });

  return { functionIds, components, violations: collectViolations(program, file, functionIds), usesHook };
}
