import fs from "fs";
import path from "path";
import { parse } from "@babel/parser";
import type { Node } from "./aos-ast";

// 앱 소스 전체 인덱스 (AOS-4902 멀티모듈).
//
// 앱빌더 앱이 App.tsx 한 파일에서 여러 모듈(src/app/components/*.tsx …)로 나뉘면, 파일 하나만 보는
// 분석은 경계를 넘는 사실을 모른다 — FUNCTIONS 를 다른 모듈에서 import 하거나, App 이 조회한 데이터를
// 다른 파일의 컴포넌트에 props 로 넘기는 경우다. 그래서 src/ 의 소스를 한 번에 들고 import/export 를
// 해석하는 인덱스를 둔다.
//
// Vite 의 모듈 그래프를 쓰지 않는 이유: build 에서는 transform 순서상 아직 변환되지 않은 모듈의 내용이
// 필요하고, dev 에서는 브라우저가 요청하지 않은 모듈이 그래프에 아예 없다. 소스는 디스크에서 직접 읽고,
// transform 이 받은 코드로 덮어써 최신을 유지한다.
//
// 분석 결과는 version 단위로 캐시한다. 내용이 같은 set 은 version 을 올리지 않으므로, dev 에서 모듈마다
// transform 이 돌아도 프로젝트 분석은 파일이 실제로 바뀔 때만 다시 한다.

export const SOURCE_EXT = /\.[jt]sx?$/;
// import 해석 시 붙여 보는 확장자 (Vite 기본 resolve.extensions 중 소스만)
const RESOLVE_EXT = [".tsx", ".ts", ".jsx", ".js"];

/** 인덱스 대상인가 — `src/` 아래 소스 중 테스트·선언 파일 제외 */
export function isIndexable(file: string): boolean {
  return (
    file.startsWith("src/") &&
    SOURCE_EXT.test(file) &&
    !file.startsWith("src/test/") &&
    !file.includes("/node_modules/") &&
    !/\.(test|spec)\.[jt]sx?$/.test(file) &&
    !file.endsWith(".d.ts")
  );
}

export interface ImportBinding {
  /** import 문의 모듈 지정자 원문 (`@/app/constants`, `./Chart`, `recharts`) */
  source: string;
  /** 가져온 이름 — `default` / 이름 / `*`(namespace) */
  imported: string;
  typeOnly: boolean;
}

/** export 이름이 가리키는 것 — 이 모듈의 지역 이름이거나, 다른 모듈의 export 를 다시 내보낸 것 */
export type ExportEntry = { local: string } | { source: string; imported: string };

export interface ModuleInfo {
  file: string;
  /** 파싱 실패면 null — 식별자는 부가 기능이라 문법 오류 보고는 뒤의 변환기에 맡긴다 */
  program: Node | null;
  /** 지역 이름 → import */
  imports: Map<string, ImportBinding>;
  /** export 이름 → 대상 */
  exports: Map<string, ExportEntry>;
  /** `export * from "…"` 의 모듈 지정자 */
  starSources: string[];
  /** 실행 시점에 실제로 불러오는 모듈 지정자 — `import type` · type 전용 지정자는 뺀다 */
  runtimeSources: string[];
}

/** 이름 해석 결과 — 프로젝트 안의 선언 / 프로젝트 밖(패키지·namespace) / 끝까지 못 찾음 / 바인딩 없음 */
export type Resolution = { file: string; local: string } | "external" | "missing" | "unbound";

function parserPlugins(file: string): ("typescript" | "jsx")[] {
  // .ts 에 jsx 를 켜면 `<T>(x: T) => x` 제네릭 화살표 함수가 JSX 로 읽힌다
  return file.endsWith(".ts") ? ["typescript"] : ["typescript", "jsx"];
}

export function parseSource(code: string, file: string): Node | null {
  try {
    const ast = parse(code, {
      sourceType: "module",
      plugins: parserPlugins(file),
      errorRecovery: true,
    }) as unknown as Node;
    return ast.program as Node;
  } catch {
    return null;
  }
}

function nameOf(node: Node): string {
  return ((node.name ?? node.value) as string) ?? "";
}

function declaredNames(decl: Node): string[] {
  if ((decl.type === "FunctionDeclaration" || decl.type === "ClassDeclaration") && decl.id) {
    return [(decl.id as Node).name as string];
  }
  if (decl.type === "VariableDeclaration") {
    return (decl.declarations as Node[])
      .map((d) => d.id as Node)
      .filter((id) => id.type === "Identifier")
      .map((id) => id.name as string);
  }
  return [];
}

/** `export default X` · `export default memo(X)` 의 지역 이름 (익명이면 null) */
function defaultExportLocal(decl: Node): string | null {
  if ((decl.type === "FunctionDeclaration" || decl.type === "ClassDeclaration") && decl.id) {
    return (decl.id as Node).name as string;
  }
  if (decl.type === "Identifier") return decl.name as string;
  if (decl.type === "CallExpression") {
    const first = (decl.arguments as Node[])[0];
    return first ? defaultExportLocal(first) : null;
  }
  return null;
}

export function buildModuleInfo(file: string, program: Node | null): ModuleInfo {
  const info: ModuleInfo = {
    file,
    program,
    imports: new Map(),
    exports: new Map(),
    starSources: [],
    runtimeSources: [],
  };
  if (!program) return info;

  for (const stmt of program.body as Node[]) {
    if (stmt.type === "ImportDeclaration") {
      const source = (stmt.source as Node).value as string;
      const declType = stmt.importKind === "type";
      const specifiers = stmt.specifiers as Node[];
      // 실행 시점 간선은 선언 단위로 정한다. verbatimModuleSyntax(tsconfig.app)에서는 선언 전체가
      // `import type` 일 때만 지워지고, `import { type B } from "./b"` 는 `import {} from "./b"` 로 남아
      // b 를 평가한다 — 지정자 단위로 빼면 이 꼴로만 이어진 순환을 놓친다.
      const runtime = !declType;
      for (const spec of specifiers) {
        const local = (spec.local as Node).name as string;
        const typeOnly = declType || spec.importKind === "type";
        const imported =
          spec.type === "ImportDefaultSpecifier"
            ? "default"
            : spec.type === "ImportNamespaceSpecifier"
              ? "*"
              : nameOf(spec.imported as Node);
        info.imports.set(local, { source, imported, typeOnly });
      }
      if (runtime) info.runtimeSources.push(source);
    } else if (stmt.type === "ExportNamedDeclaration") {
      const source = stmt.source ? (((stmt.source as Node).value as string) ?? null) : null;
      const declType = stmt.exportKind === "type";
      if (stmt.declaration) {
        for (const name of declaredNames(stmt.declaration as Node)) info.exports.set(name, { local: name });
      }
      for (const spec of (stmt.specifiers as Node[]) ?? []) {
        if (spec.type !== "ExportSpecifier") continue; // `export * as ns from` — namespace 는 따라가지 않는다
        const exported = nameOf(spec.exported as Node);
        const local = nameOf(spec.local as Node);
        info.exports.set(exported, source ? { source, imported: local } : { local });
      }
      // import 와 같다 — `export { type X } from "./b"` 도 `export {} from "./b"` 로 남는다.
      if (source && !declType) info.runtimeSources.push(source);
    } else if (stmt.type === "ExportDefaultDeclaration") {
      const local = defaultExportLocal(stmt.declaration as Node);
      if (local) info.exports.set("default", { local });
    } else if (stmt.type === "ExportAllDeclaration") {
      const source = (stmt.source as Node).value as string;
      if (stmt.exportKind !== "type") {
        info.starSources.push(source);
        info.runtimeSources.push(source);
      }
    }
  }
  return info;
}

interface Entry {
  code: string | null;
  info: ModuleInfo | null;
}

export class AosProject {
  private entries = new Map<string, Entry>();
  private version = 0;
  private cache = new Map<string, { version: number; value: unknown }>();

  /** 메모리의 소스로 만든다 (테스트·단일 파일 분석용) */
  static fromSources(sources: Record<string, string>): AosProject {
    const project = new AosProject();
    for (const [file, code] of Object.entries(sources)) project.set(file, code);
    return project;
  }

  /** 이미 파싱한 프로그램 하나로 만든다 (기존 단일 파일 API 용) */
  static fromProgram(file: string, program: Node): AosProject {
    const project = new AosProject();
    project.entries.set(file, { code: null, info: buildModuleInfo(file, program) });
    project.version++;
    return project;
  }

  /** `<root>/src` 를 디스크에서 읽어 만든다 */
  static fromDisk(root: string): AosProject {
    const project = new AosProject();
    const visit = (dir: string) => {
      let dirents: fs.Dirent[];
      try {
        dirents = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const dirent of dirents) {
        if (dirent.name === "node_modules" || dirent.name.startsWith(".")) continue;
        const abs = path.join(dir, dirent.name);
        if (dirent.isDirectory()) {
          visit(abs);
          continue;
        }
        const file = path.relative(root, abs).split(path.sep).join("/");
        if (!isIndexable(file)) continue;
        try {
          project.set(file, fs.readFileSync(abs, "utf8"));
        } catch {
          // 읽는 도중 지워진 파일 — 다음 변경 때 다시 잡힌다
        }
      }
    };
    visit(path.join(root, "src"));
    return project;
  }

  /** 내용이 바뀌었을 때만 true (version 이 오른다) */
  set(file: string, code: string): boolean {
    const current = this.entries.get(file);
    if (current && current.code === code) return false;
    this.entries.set(file, { code, info: null });
    this.version++;
    return true;
  }

  delete(file: string): boolean {
    if (!this.entries.delete(file)) return false;
    this.version++;
    return true;
  }

  has(file: string): boolean {
    return this.entries.has(file);
  }

  files(): string[] {
    return [...this.entries.keys()].sort();
  }

  /** 소스 원문 (파싱한 프로그램으로 만든 항목이면 null) */
  sourceOf(file: string): string | null {
    return this.entries.get(file)?.code ?? null;
  }

  module(file: string): ModuleInfo | null {
    const entry = this.entries.get(file);
    if (!entry) return null;
    if (!entry.info) entry.info = buildModuleInfo(file, parseSource(entry.code ?? "", file));
    return entry.info;
  }

  /** version 이 같으면 이전 계산을 돌려준다 */
  memo<T>(key: string, compute: () => T): T {
    const hit = this.cache.get(key);
    if (hit && hit.version === this.version) return hit.value as T;
    const value = compute();
    this.cache.set(key, { version: this.version, value });
    return value;
  }

  /**
   * 모듈 지정자를 프로젝트 파일로 해석한다. `@/` 는 `src/`, `./` `../` 는 상대 경로.
   * 패키지 import 나 인덱스에 없는 파일이면 null.
   */
  resolve(from: string, specifier: string): string | null {
    const clean = specifier.split("?", 1)[0];
    let base: string;
    if (clean.startsWith("@/")) base = `src/${clean.slice(2)}`;
    else if (clean.startsWith("./") || clean.startsWith("../")) base = path.posix.join(path.posix.dirname(from), clean);
    else return null;
    base = path.posix.normalize(base);
    const candidates = [base, ...RESOLVE_EXT.map((ext) => base + ext), ...RESOLVE_EXT.map((ext) => `${base}/index${ext}`)];
    // TS ESM 관례 — `./x.js` 로 써도 x.ts 를 가리킨다
    if (/\.jsx?$/.test(base)) {
      const stem = base.replace(/\.jsx?$/, "");
      candidates.push(`${stem}.ts`, `${stem}.tsx`);
    }
    return candidates.find((candidate) => this.entries.has(candidate)) ?? null;
  }

  /** 모듈이 실행 시점에 불러오는 프로젝트 파일 (해석된 것만, 중복 없이 정렬) */
  runtimeImports(file: string): string[] {
    const info = this.module(file);
    if (!info) return [];
    const resolved = new Set<string>();
    for (const source of info.runtimeSources) {
      const target = this.resolve(file, source);
      if (target) resolved.add(target);
    }
    return [...resolved].sort();
  }

  /** `@/` · 상대 경로인데 프로젝트 파일로 해석되지 않는 지정자 — 없는 파일을 import 한 자리 */
  unresolvedImports(file: string): string[] {
    const info = this.module(file);
    if (!info) return [];
    const local = (s: string) => s.startsWith("@/") || s.startsWith("./") || s.startsWith("../");
    const sources = new Set<string>([
      ...[...info.imports.values()].map((b) => b.source),
      ...info.runtimeSources,
    ]);
    return [...sources].filter((s) => local(s) && isSourceLike(s) && this.resolve(file, s) === null).sort();
  }

  /** 파일 안의 지역 이름이 가리키는 선언을 import 를 따라 찾는다 */
  resolveName(file: string, name: string, depth = 0): Resolution {
    const info = this.module(file);
    const binding = info?.imports.get(name);
    if (!binding) return "unbound";
    if (binding.imported === "*") return "external";
    const target = this.resolve(file, binding.source);
    if (!target) return "external";
    return this.resolveExport(target, binding.imported, depth + 1);
  }

  /** 모듈의 export 이름이 가리키는 선언 — 재수출(`export { X } from`, `export *`)도 따라간다 */
  resolveExport(file: string, exported: string, depth = 0): Resolution {
    if (depth > 16) return "missing";
    const info = this.module(file);
    if (!info) return "missing";
    const entry = info.exports.get(exported);
    if (entry) {
      if ("local" in entry) {
        // `import { X } from "./y"; export { X }` — 지역 이름이 다시 import 면 한 번 더 따라간다
        return info.imports.has(entry.local) ? this.resolveName(file, entry.local, depth + 1) : { file, local: entry.local };
      }
      const target = this.resolve(file, entry.source);
      return target ? this.resolveExport(target, entry.imported, depth + 1) : "external";
    }
    if (exported !== "default") {
      for (const source of info.starSources) {
        const target = this.resolve(file, source);
        if (!target) continue;
        const found = this.resolveExport(target, exported, depth + 1);
        if (typeof found === "object") return found;
      }
    }
    return "missing";
  }
}

// 확장자가 소스가 아닌 import(`./theme.css`, `./logo.svg`)는 인덱스 대상이 아니므로 미해석으로 치지 않는다
function isSourceLike(specifier: string): boolean {
  const last = specifier.split("?", 1)[0].split("/").pop() ?? "";
  return !last.includes(".") || SOURCE_EXT.test(last);
}

/**
 * 실행 시점 import 그래프의 순환 — Tarjan SCC 중 크기 2 이상이거나 자기 자신을 import 하는 것.
 * 각 순환의 파일은 정렬하고, 목록도 정렬해 결과가 입력 순서와 무관하게 같다.
 */
export function findCycles(graph: Map<string, string[]>): string[][] {
  let index = 0;
  const indices = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cycles: string[][] = [];

  const strongConnect = (node: string) => {
    indices.set(node, index);
    lowlink.set(node, index);
    index++;
    stack.push(node);
    onStack.add(node);
    for (const next of graph.get(node) ?? []) {
      if (!graph.has(next)) continue;
      if (!indices.has(next)) {
        strongConnect(next);
        lowlink.set(node, Math.min(lowlink.get(node)!, lowlink.get(next)!));
      } else if (onStack.has(next)) {
        lowlink.set(node, Math.min(lowlink.get(node)!, indices.get(next)!));
      }
    }
    if (lowlink.get(node) !== indices.get(node)) return;
    const component: string[] = [];
    for (;;) {
      const member = stack.pop()!;
      onStack.delete(member);
      component.push(member);
      if (member === node) break;
    }
    const selfLoop = component.length === 1 && (graph.get(node) ?? []).includes(node);
    if (component.length > 1 || selfLoop) cycles.push(component.sort());
  };

  for (const node of [...graph.keys()].sort()) {
    if (!indices.has(node)) strongConnect(node);
  }
  return cycles.sort((a, b) => a.join("\n").localeCompare(b.join("\n")));
}
