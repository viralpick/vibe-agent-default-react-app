import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSimulationAggregate, useSimulationOverlay } from "./useSimulationResult";

const post = vi.fn();
// 실제 useApiClient 처럼 렌더마다 같은 client 를 돌려준다
const client = { post };
vi.mock("@/api/api.client", () => ({ useApiClient: () => client }));

const MARGIN = { id: "saved-1" };
const BASE = { id: "saved-0" };
const ROWS = "/simulation/saved-states/saved-1/overlay/rows";
const AGGREGATE = "/simulation/saved-states/overlay/aggregate";

function ok(data: unknown) {
  return { data: { data: data } };
}

function httpError(status: number) {
  return Object.assign(new Error(`Request failed with status code ${status}`), { response: { status } });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  post.mockReset();
});

describe("useSimulationOverlay", () => {
  it("조건을 그대로 실어 저장본 overlay 를 조회한다", async () => {
    const page = { items: [{ objectKey: "1", values: { margin: { valueState: "ABSENT" } } }], nextCursor: "c2" };
    post.mockResolvedValue(ok(page));
    const sort = { property: "margin", part: "DELTA" as const, direction: "DESC" as const };

    const hook = renderHook(() =>
      useSimulationOverlay(MARGIN, { tenantId: "7", objectType: "product", properties: ["margin"], sort, limit: 50, cursor: "c1" }),
    );

    expect(hook.result.current.status).toBe("running");
    await waitFor(() => expect(hook.result.current.status).toBe("success"));
    expect(post).toHaveBeenCalledWith(
      ROWS,
      { objectType: "product", properties: ["margin"], sort, limit: 50, cursor: "c1" },
      expect.objectContaining({ headers: { "X-Tenant-Id": "7" } }),
    );
    expect(hook.result.current).toMatchObject({ data: page, isLoading: false, isForbidden: false, error: null });
  });

  it("403 은 오류가 아니라 forbidden 이다", async () => {
    post.mockRejectedValue(httpError(403));
    const hook = renderHook(() => useSimulationOverlay(MARGIN, { tenantId: "7", objectType: "product" }));

    await waitFor(() => expect(hook.result.current.status).toBe("forbidden"));
    expect(hook.result.current).toMatchObject({ isForbidden: true, data: null });
  });

  it("그 밖의 실패는 error 이고 reject 하지 않는다", async () => {
    post.mockRejectedValue(httpError(500));
    const hook = renderHook(() => useSimulationOverlay(MARGIN, { tenantId: "7", objectType: "product" }));

    await waitFor(() => expect(hook.result.current.status).toBe("error"));
    expect(hook.result.current.isForbidden).toBe(false);
    expect(hook.result.current.error?.message).toContain("500");
  });

  it("enabled=false 면 조회하지 않고 idle 이다", () => {
    const hook = renderHook(() => useSimulationOverlay(MARGIN, { tenantId: "7", objectType: "product", enabled: false }));

    expect(post).not.toHaveBeenCalled();
    expect(hook.result.current.status).toBe("idle");
  });

  it("조건이 바뀌면 늦게 온 이전 응답을 버린다", async () => {
    const first = deferred<unknown>();
    post.mockReturnValueOnce(first.promise).mockResolvedValueOnce(ok({ items: [], nextCursor: null, page: 2 }));
    const hook = renderHook(({ cursor }) => useSimulationOverlay(MARGIN, { tenantId: "7", objectType: "product", cursor }), {
      initialProps: { cursor: null as string | null },
    });

    hook.rerender({ cursor: "c2" });
    await waitFor(() => expect(hook.result.current.data).toMatchObject({ page: 2 }));
    await act(async () => first.resolve(ok({ items: [], nextCursor: "c2", page: 1 })));

    expect(hook.result.current.data).toMatchObject({ page: 2 });
  });

  it("refetch 는 같은 조건으로 다시 조회한다", async () => {
    post.mockResolvedValue(ok({ items: [] }));
    const hook = renderHook(() => useSimulationOverlay(MARGIN, { tenantId: "7", objectType: "product" }));
    await waitFor(() => expect(hook.result.current.status).toBe("success"));

    act(() => hook.result.current.refetch());

    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  });

  it("렌더마다 새로 만든 같은 조건으로는 다시 조회하지 않는다", async () => {
    post.mockResolvedValue(ok({ items: [] }));
    const hook = renderHook(() => useSimulationOverlay(MARGIN, { tenantId: "7", objectType: "product", properties: ["margin"] }));
    await waitFor(() => expect(hook.result.current.status).toBe("success"));

    hook.rerender();

    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe("useSimulationAggregate", () => {
  it("저장본 배열을 순서대로 savedStateIds 로 싣는다", async () => {
    post.mockResolvedValue(ok({ groups: [] }));
    const hook = renderHook(() =>
      useSimulationAggregate([BASE, MARGIN], { tenantId: "7", objectType: "product", groupBy: ["category"] }),
    );

    await waitFor(() => expect(hook.result.current.status).toBe("success"));
    expect(post).toHaveBeenCalledWith(
      AGGREGATE,
      { savedStateIds: ["saved-0", "saved-1"], objectType: "product", groupBy: ["category"] },
      expect.objectContaining({ headers: { "X-Tenant-Id": "7" } }),
    );
  });

  it("저장본 하나도 받는다", async () => {
    post.mockResolvedValue(ok({ groups: [] }));
    renderHook(() => useSimulationAggregate(MARGIN, { tenantId: "7", objectType: "product" }));

    await waitFor(() => expect(post).toHaveBeenCalledWith(AGGREGATE, expect.objectContaining({ savedStateIds: ["saved-1"] }), expect.anything()));
  });

  it("403 은 forbidden 이다", async () => {
    post.mockRejectedValue(httpError(403));
    const hook = renderHook(() => useSimulationAggregate(MARGIN, { tenantId: "7", objectType: "product" }));

    await waitFor(() => expect(hook.result.current.status).toBe("forbidden"));
  });
});
