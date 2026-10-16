import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aosLocator } from "./aos-locator";

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
  const plugin: Plugin = aosLocator();
  (plugin.configResolved as (config: ResolvedConfig) => void)({ root, command: "serve" } as ResolvedConfig);
  transform = (plugin.transform as unknown as Transform).bind({});
});

afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("aosLocator — transform", () => {
  it("App 이 넘긴 데이터의 출처를 다른 파일의 컴포넌트에 주입한다", () => {
    expect(chartFunctions()).toBe("uuid-orders");
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
