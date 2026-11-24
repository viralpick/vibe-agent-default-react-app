import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fixtureAdapter,
  isFixtureMode,
  isFixtureRequest,
  parameterKey,
  type FunctionFixture,
} from "./fixture-adapter";

const FUNCTION_ID = "0b6a2f1e-5c7d-4c1a-9f3e-2d8b7a6c5e4f";

const fixtureOf = (overrides: Partial<FunctionFixture> = {}): FunctionFixture => ({
  functionId: FUNCTION_ID,
  parameters: { from: "2026-11-01" },
  savedAt: "2026-11-20T00:00:00+00:00",
  rowCount: 2,
  truncated: false,
  result: [{ region: "서울" }, { region: "부산" }],
  ...overrides,
});

const call = (url: string, data?: unknown) => ({ url, data, headers: {} }) as never;

afterEach(() => vi.restoreAllMocks());

describe("로컬 프리뷰 fixture 모드", () => {
  it("dev 서버에 명시적인 환경변수를 줬을 때만 켜진다", () => {
    expect(isFixtureMode({ DEV: true, VITE_AOS_PREVIEW: "fixture" })).toBe(true);
    // 샌드박스 웹 프리뷰도 dev 서버라 환경변수 없이는 켜지면 안 된다
    expect(isFixtureMode({ DEV: true })).toBe(false);
    // 게시 빌드
    expect(isFixtureMode({ DEV: false, VITE_AOS_PREVIEW: "fixture" })).toBe(false);
  });

  it("함수 실행과 액션 호출만 가로챈다", () => {
    expect(isFixtureRequest(`/ontology-functions/${FUNCTION_ID}/run`)).toBe(true);
    expect(isFixtureRequest(`/ontology-actions/${FUNCTION_ID}/runs`)).toBe(true);
    expect(isFixtureRequest(`/ontology-actions/${FUNCTION_ID}/runs/r1`)).toBe(true);
    expect(isFixtureRequest(`/ontology-functions/${FUNCTION_ID}/inspect`)).toBe(false);
    expect(isFixtureRequest("/dashboards/groups")).toBe(false);
  });

  it("함수는 그 파라미터로 저장해 둔 결과로 답한다 — 서버 응답과 같은 모양", async () => {
    const key = await parameterKey({ from: "2026-11-01" });
    const load = vi.fn(async (path: string) => (path === `${FUNCTION_ID}/${key}.json` ? fixtureOf() : null));

    const response = await fixtureAdapter(load)(
      call(`/ontology-functions/${FUNCTION_ID}/run`, JSON.stringify({ parameters: { from: "2026-11-01" } })),
    );

    expect(load).toHaveBeenCalledTimes(1);
    expect(response.data.meta.code).toBe("Success");
    expect(response.data.data.result).toEqual([{ region: "서울" }, { region: "부산" }]);
  });

  it("fixture 가 없으면 받는 방법을 알리는 오류로 끝난다", async () => {
    const adapter = fixtureAdapter(async () => null);

    await expect(adapter(call(`/ontology-functions/${FUNCTION_ID}/run`))).rejects.toThrow(
      `app_fixture_url(function_id="${FUNCTION_ID}", parameters={})`,
    );
  });

  it("같은 함수를 파라미터만 바꿔 부르면 각자 저장한 응답을 읽는다", async () => {
    const thisMonth = { from: "2026-11-01" };
    const lastMonth = { from: "2026-10-01" };
    const files: Record<string, FunctionFixture> = {
      [`${FUNCTION_ID}/${await parameterKey(thisMonth)}.json`]: fixtureOf({ parameters: thisMonth, result: [{ n: 2 }] }),
      [`${FUNCTION_ID}/${await parameterKey(lastMonth)}.json`]: fixtureOf({ parameters: lastMonth, result: [{ n: 1 }] }),
    };
    const adapter = fixtureAdapter(async (path) => files[path] ?? null);
    const run = (parameters: object) =>
      adapter(call(`/ontology-functions/${FUNCTION_ID}/run`, JSON.stringify({ parameters })));

    expect((await run(thisMonth)).data.data.result).toEqual([{ n: 2 }]);
    expect((await run(lastMonth)).data.data.result).toEqual([{ n: 1 }]);
  });

  it("저장하지 않은 파라미터면 마지막으로 받은 응답으로 답하고 한 번만 알린다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const adapter = fixtureAdapter(async (path) => (path === `${FUNCTION_ID}.json` ? fixtureOf() : null));
    const body = JSON.stringify({ parameters: { from: "2026-10-01" } });

    const response = await adapter(call(`/ontology-functions/${FUNCTION_ID}/run`, body));
    await adapter(call(`/ontology-functions/${FUNCTION_ID}/run`, body));

    expect(response.data.data.result).toEqual([{ region: "서울" }, { region: "부산" }]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("저장하지 않은 파라미터");
  });

  it("파라미터 키는 agent-app 과 같은 예시로 같은 값이다", async () => {
    // agent-app `test/tool/app_builder/test_local_fixture.py` 의 PARAMETER_KEY_VECTORS 와 같다. 한쪽만 고치지 않는다.
    const vectors: [Record<string, unknown>, string][] = [
      [{}, "44136fa355b3678a"],
      [{ from: "2026-10-01", to: "2026-10-31" }, "71f64b0d656dc596"],
      [{ to: "2026-10-31", from: "2026-10-01" }, "71f64b0d656dc596"],
      [{ region: "서울", limit: 10 }, "39a892dd74c38f6b"],
      [{ limit: 10.0, region: "서울" }, "39a892dd74c38f6b"],
      [{ ids: [3, 1], filter: { b: true, a: null } }, "e1162981c19ce4bd"],
      [{ rate: 0.5 }, "76cc9dea7f7510d7"],
    ];
    for (const [parameters, expected] of vectors) {
      expect(await parameterKey(parameters)).toBe(expected);
    }
  });

  it("액션은 실행하지 않은 성공으로 답하고 파일을 읽지 않는다", async () => {
    const load = vi.fn();

    const response = await fixtureAdapter(load)(call(`/ontology-actions/${FUNCTION_ID}/runs`));

    expect(load).not.toHaveBeenCalled();
    expect(response.data.data).toMatchObject({ status: "SUCCEEDED", fixture: true });
  });
});
