import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isLocalMockMode,
  LOCAL_MOCK_NOTICE_ID,
  mockActionRun,
  mockFunctionRows,
  resetLocalMockState,
} from "./localMock";

afterEach(() => {
  resetLocalMockState();
  vi.restoreAllMocks();
});

describe("isLocalMockMode", () => {
  it("dev 서버에서 VITE_AOS_PREVIEW=mock 일 때만 켜진다", () => {
    expect(isLocalMockMode({ DEV: true, VITE_AOS_PREVIEW: "mock" })).toBe(true);
    // 샌드박스 웹 프리뷰도 DEV 다 — 환경변수 없이는 켜지지 않는다
    expect(isLocalMockMode({ DEV: true })).toBe(false);
    // 게시 빌드
    expect(isLocalMockMode({ DEV: false, VITE_AOS_PREVIEW: "mock" })).toBe(false);
  });
});

describe("mockFunctionRows", () => {
  it("더미 파일의 result 행으로 답한다", async () => {
    const load = vi.fn().mockResolvedValue({ result: [{ region: "서울", amount: 3 }] });

    expect(await mockFunctionRows("fn-sales", load)).toEqual([{ region: "서울", amount: 3 }]);
    expect(load).toHaveBeenCalledWith("fn-sales");
  });

  it("파일이 없으면 빈 결과로 답하고 한 번만 알린다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const load = vi.fn().mockResolvedValue(null);

    expect(await mockFunctionRows("fn-missing", load)).toEqual([]);
    expect(await mockFunctionRows("fn-missing", load)).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(".cos/mocks/fn-missing.json");
  });

  it("result 가 배열이 아니면 없는 파일과 같이 본다", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(await mockFunctionRows("fn-bad", vi.fn().mockResolvedValue({ result: "x" }))).toEqual([]);
  });

  it("더미 데이터 안내를 화면에 한 번 붙인다", async () => {
    const load = vi.fn().mockResolvedValue({ result: [] });

    await mockFunctionRows("a", load);
    await mockFunctionRows("b", load);

    expect(document.querySelectorAll(`#${LOCAL_MOCK_NOTICE_ID}`)).toHaveLength(1);
  });
});

describe("mockActionRun", () => {
  it("실행하지 않은 성공을 돌려준다", () => {
    expect(mockActionRun("act-1")).toMatchObject({ status: "SUCCEEDED", actionId: "act-1", mock: true });
  });
});
