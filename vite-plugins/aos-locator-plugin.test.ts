import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ModuleNode, Plugin, ResolvedConfig, ViteDevServer } from "vite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AOS_MANIFEST_FILE, analyzeProject, aosLocator } from "./aos-locator";
import { AosProject } from "./aos-project";

// 플러그인 훅 자체 — 파일 하나만 보는 analyzeAosSource 테스트로는 잡히지 않는, 프로젝트 인덱스를
// 공유하는 동작을 본다.

const HOOK = "export function useOntologyFunction(fn, options) { return { data: [] }; }";
const CONSTANTS = `export const FUNCTIONS = { orders: { id: "uuid-orders", description: "주문" } };
export const TENANT_ID = "1";`;
const APP = `import { useOntologyFunction } from "@/hooks/useOntologyFunction";
import { FUNCTIONS, TENANT_ID } from "@/modules/constants";
import { SalesChart } from "@/modules/SalesChart";

export default function App() {
  const orders = useOntologyFunction(FUNCTIONS.orders, { tenantId: TENANT_ID });
  return <main><SalesChart rows={orders.data} /></main>;
}`;
const SALES_CHART = `export function SalesChart({ rows }) {
  return <section data-aos-id="sales-chart">{rows.length}</section>;
}`;

type Transform = (code: string, id: string) => { code: string } | null;

let root: string;
let plugin: Plugin;
let transform: Transform;

const abs = (relative: string) => path.join(root, relative);
const write = (relative: string, code: string) => {
  fs.mkdirSync(path.dirname(abs(relative)), { recursive: true });
  fs.writeFileSync(abs(relative), code);
};
const chartFunctions = (): string | null => {
  const out = transform(SALES_CHART, abs("src/modules/SalesChart.tsx"));
  return out?.code.match(/data-aos-functions="([^"]*)"/)?.[1] ?? null;
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "aos-locator-"));
  write("src/hooks/useOntologyFunction.ts", HOOK);
  write("src/modules/constants.ts", CONSTANTS);
  write("src/App.tsx", APP);
  write("src/modules/SalesChart.tsx", SALES_CHART);
  plugin = aosLocator();
  (plugin.configResolved as (config: ResolvedConfig) => void)({ root, command: "serve" } as ResolvedConfig);
  transform = (plugin.transform as unknown as Transform).bind({});
});

afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("aosLocator — transform", () => {
  it("App 이 넘긴 데이터의 출처를 다른 파일의 컴포넌트에 주입한다", () => {
    expect(chartFunctions()).toBe("uuid-orders");
  });

  it("가져와서 잇기 전인 앱은 자리표시를 그대로 주입한다 — 미리보기가 이걸로 샘플 위젯을 표시한다", () => {
    write("src/modules/constants.ts", CONSTANTS.replace("uuid-orders", "aos-unbound:function:orders"));
    expect(chartFunctions()).toBe("aos-unbound:function:orders");
  });

  it.each(["?raw", "?url", "?inline", "?import&raw"])(
    "쿼리가 붙은 요청(%s)은 소스가 아니다 — 인덱스를 덮지 않는다",
    (query) => {
      // Vite 의 ?raw 는 `export default "<원문>"` 으로 온다. 이걸 App.tsx 로 읽으면 import·props 가 사라진다
      expect(transform(`export default ${JSON.stringify(APP)};`, `${abs("src/App.tsx")}${query}`)).toBeNull();
      expect(chartFunctions()).toBe("uuid-orders");
    },
  );
});

describe("aosLocator — 파일 추가 · 삭제", () => {
  it("다른 파일의 주입값이 바뀌면 그 모듈을 HMR 로 다시 보낸다", () => {
    // Vite 는 add/unlink 에 handleHotUpdate 를 부르지 않는다 — 무효화만 하면 새로고침 전까지 옛 값이다
    const handlers = new Map<string, (file: string) => void>();
    const modules = new Map<string, ModuleNode>();
    const moduleOf = (file: string) => {
      if (!modules.has(file)) modules.set(file, { file } as ModuleNode);
      return modules.get(file)!;
    };
    const reloadModule = vi.fn(async (_mod: ModuleNode) => {});
    const server = {
      watcher: { on: (event: string, handler: (file: string) => void) => handlers.set(event, handler) },
      moduleGraph: {
        getModulesByFile: (file: string) => new Set([moduleOf(file)]),
        invalidateModule: vi.fn(),
      },
      reloadModule,
    } as unknown as ViteDevServer;
    (plugin.configureServer as (server: ViteDevServer) => void)(server);
    expect(chartFunctions()).toBe("uuid-orders");

    // FUNCTIONS 를 선언한 파일이 사라지면 App 이 넘기던 데이터의 출처가 없어진다 — SalesChart 가 낡는다
    fs.rmSync(abs("src/modules/constants.ts"));
    handlers.get("unlink")!(abs("src/modules/constants.ts"));

    const reloaded = reloadModule.mock.calls.map(([mod]) => mod.file);
    expect(reloaded).toContain(abs("src/modules/SalesChart.tsx"));
    expect(reloaded).not.toContain(abs("src/modules/constants.ts"));
  });
});

describe("aosLocator — build", () => {
  it("매니페스트의 파일 · 모듈은 실제 번들에 들어간 파일로 좁힌다", () => {
    // 옛 앱이 남긴 파일처럼 디스크에는 있지만 import 되지 않는 파일은 싣지 않는다
    write("src/modules/Orphan.tsx", `export function Orphan() { return <div data-aos-id="orphan" />; }`);
    const build = aosLocator();
    (build.configResolved as (config: ResolvedConfig) => void)({ root, command: "build" } as ResolvedConfig);
    (build.buildStart as () => void).call({});
    const transformBuild = (build.transform as unknown as Transform).bind({});
    for (const file of ["src/App.tsx", "src/modules/SalesChart.tsx", "src/modules/constants.ts", "src/hooks/useOntologyFunction.ts"]) {
      transformBuild(fs.readFileSync(abs(file), "utf8"), abs(file));
    }
    const emitted: { fileName: string; source: string }[] = [];
    (build.generateBundle as () => void).call({ emitFile: (asset: { fileName: string; source: string }) => emitted.push(asset) });

    const [asset] = emitted;
    expect(asset.fileName).toBe(AOS_MANIFEST_FILE);
    const manifest = JSON.parse(asset.source);
    const modules = manifest.modules.map((m: { file: string }) => m.file);
    expect(modules).toContain("src/modules/SalesChart.tsx");
    expect(modules).not.toContain("src/modules/Orphan.tsx");
    expect(manifest.components.map((c: { id: string }) => c.id)).not.toContain("orphan");
  });
});

describe("aosLocator — dev 갱신", () => {
  const devServer = () => {
    const modules = new Map<string, ModuleNode>();
    const moduleOf = (file: string) => {
      if (!modules.has(file)) modules.set(file, { file } as ModuleNode);
      return modules.get(file)!;
    };
    return {
      moduleOf,
      server: {
        watcher: { on: () => {} },
        moduleGraph: { getModulesByFile: (file: string) => new Set([moduleOf(file)]), invalidateModule: vi.fn() },
        reloadModule: vi.fn(async () => {}),
      } as unknown as ViteDevServer,
    };
  };
  const hotUpdate = (server: ViteDevServer, file: string, code: string, modules: ModuleNode[]) =>
    (plugin.handleHotUpdate as (ctx: unknown) => Promise<ModuleNode[] | undefined>)({
      file: abs(file),
      read: async () => code,
      server,
      modules,
    });

  it("App 이 넘기는 데이터를 바꾸면 그 데이터를 받는 다른 파일 모듈도 함께 다시 보낸다", async () => {
    const { server, moduleOf } = devServer();
    expect(chartFunctions()).toBe("uuid-orders");
    const app = moduleOf(abs("src/App.tsx"));
    const changed = APP.replace("orders.data", "[]");
    const sent = await hotUpdate(server, "src/App.tsx", changed, [app]);
    expect(sent).toEqual([app, moduleOf(abs("src/modules/SalesChart.tsx"))]);
  });

  it("문법 오류 중에는 추적이 끊겨도, 고치면 다른 파일의 주입값이 돌아온다", async () => {
    const { server, moduleOf } = devServer();
    const app = moduleOf(abs("src/App.tsx"));
    await hotUpdate(server, "src/App.tsx", APP.replace("return <main>", "return <main <"), [app]);
    fs.writeFileSync(abs("src/App.tsx"), APP);
    await hotUpdate(server, "src/App.tsx", APP, [app]);
    expect(chartFunctions()).toBe("uuid-orders");
  });
});

describe("템플릿 자체", () => {
  it("템플릿 src/ 는 데이터 흐름 위반도 순환도 없다", () => {
    // 템플릿이 스스로 규칙을 어기면 빈 앱의 verify 부터 실패한다
    const { manifest } = analyzeProject(AosProject.fromDisk(path.resolve(__dirname, "..")), { injectLoc: false });
    const violations = manifest.files.flatMap((f) => [...f.violations, ...f.actionViolations].map((v) => `${f.file} ${v.rule}`));
    expect(violations).toEqual([]);
    expect(manifest.cycles).toEqual([]);
  });
});
