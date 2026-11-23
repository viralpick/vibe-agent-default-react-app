import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureAdapter, isFixtureMode, isFixtureRequest, type FunctionFixture } from "./fixture-adapter";

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

  it("함수는 저장해 둔 결과로 답한다 — 서버 응답과 같은 모양", async () => {
    const load = vi.fn(async () => fixtureOf());

    const response = await fixtureAdapter(load)(
      call(`/ontology-functions/${FUNCTION_ID}/run`, JSON.stringify({ parameters: { from: "2026-11-01" } })),
    );

    expect(load).toHaveBeenCalledWith(FUNCTION_ID);
    expect(response.data.meta.code).toBe("Success");
    expect(response.data.data.result).toEqual([{ region: "서울" }, { region: "부산" }]);
  });

  it("fixture 가 없으면 받는 방법을 알리는 오류로 끝난다", async () => {
    const adapter = fixtureAdapter(async () => null);

    await expect(adapter(call(`/ontology-functions/${FUNCTION_ID}/run`))).rejects.toThrow(
      `app_fixture_url(function_id="${FUNCTION_ID}")`,
    );
  });

  it("다른 파라미터로 저장한 응답이면 한 번만 알린다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const adapter = fixtureAdapter(async () => fixtureOf());
    const body = JSON.stringify({ parameters: { from: "2026-10-01" } });

    await adapter(call(`/ontology-functions/${FUNCTION_ID}/run`, body));
    await adapter(call(`/ontology-functions/${FUNCTION_ID}/run`, body));

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("다른 파라미터");
  });

  it("액션은 실행하지 않은 성공으로 답하고 파일을 읽지 않는다", async () => {
    const load = vi.fn();

    const response = await fixtureAdapter(load)(call(`/ontology-actions/${FUNCTION_ID}/runs`));

    expect(load).not.toHaveBeenCalled();
    expect(response.data.data).toMatchObject({ status: "SUCCEEDED", fixture: true });
  });
});
