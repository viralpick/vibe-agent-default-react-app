// aos-locator / aos-dataflow 가 공유하는 Babel AST 최소 헬퍼.
// @babel/traverse 를 들이지 않는다 — 샌드박스 이미지에 이미 설치된 @babel/parser 만으로 동작하게.

export interface Node {
  type: string;
  start: number;
  end: number;
  loc: { start: { line: number; column: number } };
  [key: string]: unknown;
}

// AST 순회 시 건너뛸 메타 필드 (자식 노드가 아니다)
const SKIP_KEYS = new Set(["loc", "start", "end", "extra", "leadingComments", "trailingComments", "innerComments"]);

export function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && typeof (value as Node).type === "string";
}

export function childNodes(node: Node): Node[] {
  const children: Node[] = [];
  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) if (isNode(item)) children.push(item);
    } else if (isNode(child)) {
      children.push(child);
    }
  }
  return children;
}

export function walk(node: Node, visit: (node: Node) => void): void {
  visit(node);
  for (const child of childNodes(node)) walk(child, visit);
}

/** `src/App.tsx:120:8` — 라인 1-based, 칼럼 1-based */
export function locOf(file: string, node: Node): string {
  return `${file}:${node.loc.start.line}:${node.loc.start.column + 1}`;
}

export function isFunctionNode(node: Node): boolean {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression" ||
    node.type === "ObjectMethod" ||
    node.type === "ClassMethod"
  );
}

/** TS 단언·괄호 등 값에 영향 없는 래퍼를 벗긴다 */
export function unwrap(node: Node): Node {
  let current = node;
  while (
    current.type === "TSAsExpression" ||
    current.type === "TSSatisfiesExpression" ||
    current.type === "TSNonNullExpression" ||
    current.type === "ParenthesizedExpression" ||
    current.type === "AwaitExpression"
  ) {
    current = (current.expression ?? current.argument) as Node;
  }
  return current;
}

export function isPascalCase(name: string): boolean {
  const first = name.charAt(0);
  return first >= "A" && first <= "Z";
}
