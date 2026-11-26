import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSimulationAggregate, useSimulationOverlay, useSimulationSavedStates } from "./useSimulationResult";

const post = vi.fn();
const get = vi.fn();
// 실제 useApiClient 처럼 렌더마다 같은 client 를 돌려준다
const client = { post, get };
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
  get.mockReset();
});

describe("useSimulationOverlay", () => {
  it("조건을 그대로 실어 저장본 overlay 를 조회한다", async () => {
    const page = { items: [{ objectKey: "1", values: { margin: { valueState: "ABSENT" } } }], nextCursor: "c2" };
    post.mockResolvedValue(ok(page));
    const sort = { property: "margin", part: "DELTA" as const, direction: "DESC" as const };
    const filters = [{ property: "category", operator: "EQ", values: ["A"] }];

    const hook = renderHook(() =>
      useSimulationOverlay(MARGIN, { tenantId: "7", objectType: "product", properties: ["margin"], filters, sort, limit: 50, cursor: "c1" }),
    );

    expect(hook.result.current.status).toBe("running");
    await waitFor(() => expect(hook.result.current.status).toBe("success"));
    expect(post).toHaveBeenCalledWith(
      ROWS,
      { objectType: "product", properties: ["margin"], filters, sort, limit: 50, cursor: "c1" },
      expect.objectContaining({ headers: { "X-Tenant-Id": "7" } }),
    );
    expect(hook.result.current).toMatchObject({ data: page, isLoading: false, isForbidden: false, error: null });
  });

  it("403 은 오류가 아니라 forbidden 이다", async () => {
    post.mockRejectedValue(httpError(403));
    const hook = renderHook(() => useSimulationOverlay(MARGIN, { tenantId: "7", objectType: "product" }));

    await waitFor(() => expect(hook.result.current.status).toBe("forbidden"));
    expect(hook.result.current).toMatchObject({ isForbidden: true, data: null, error: null });
  });

  it("그 밖의 실패는 error 다", async () => {
    post.mockRejectedValue(httpError(500));
    const hook = renderHook(() => useSimulationOverlay(MARGIN, { tenantId: "7", objectType: "product" }));

    await waitFor(() => expect(hook.result.current.status).toBe("error"));
    expect(hook.result.current.isForbidden).toBe(false);
    expect(hook.result.current.error?.message).toContain("500");
  });

  it("enabled 를 끄면 진행 중인 요청을 끊고 idle 로 돌아간다", async () => {
    post.mockReturnValue(new Promise(() => {}));
    const hook = renderHook(({ enabled }) => useSimulationOverlay(MARGIN, { tenantId: "7", objectType: "product", enabled }), {
      initialProps: { enabled: true },
    });
    const { signal } = post.mock.calls[0][2] as { signal: AbortSignal };

    hook.rerender({ enabled: false });

    expect(signal.aborted).toBe(true);
    expect(hook.result.current.status).toBe("idle");
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

  it("저장본을 바꾸면 응답이 오기 전까지 이전 저장본의 행을 보여 주지 않는다", async () => {
    post.mockResolvedValueOnce(ok({ items: [], page: "a" })).mockReturnValueOnce(new Promise(() => {}));
    const hook = renderHook(({ saved }) => useSimulationOverlay(saved, { tenantId: "7", objectType: "product" }), {
      initialProps: { saved: MARGIN },
    });
    await waitFor(() => expect(hook.result.current.data).toMatchObject({ page: "a" }));

    hook.rerender({ saved: BASE });

    expect(hook.result.current).toMatchObject({ status: "running", data: null });
  });

  it("상수에 없는 key 로 불러도 렌더에서 던지지 않는다", async () => {
    post.mockRejectedValue(httpError(400));
    const missing = undefined as unknown as typeof MARGIN;
    const hook = renderHook(() => useSimulationOverlay(missing, { tenantId: "7", objectType: "product" }));

    await waitFor(() => expect(hook.result.current.status).toBe("error"));
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
      useSimulationAggregate([BASE, MARGIN], { tenantId: "7", objectType: "product", properties: ["margin"], groupBy: ["category"], filters: [] }),
    );

    await waitFor(() => expect(hook.result.current.status).toBe("success"));
    expect(post).toHaveBeenCalledWith(
      AGGREGATE,
      { savedStateIds: ["saved-0", "saved-1"], objectType: "product", properties: ["margin"], groupBy: ["category"], filters: [] },
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

describe("결과 hook 에 고른 저장본이 아직 없을 때 (AOS-9031)", () => {
  it("overlay 는 null 저장본이면 조회하지 않고 idle 이다", () => {
    const hook = renderHook(() => useSimulationOverlay(null, { tenantId: "7", objectType: "product" }));

    expect(post).not.toHaveBeenCalled();
    expect(hook.result.current.status).toBe("idle");
  });

  it("aggregate 는 하나라도 null 이면 조회하지 않는다", () => {
    const hook = renderHook(() => useSimulationAggregate([BASE, null], { tenantId: "7", objectType: "product" }));

    expect(post).not.toHaveBeenCalled();
    expect(hook.result.current.status).toBe("idle");
  });
});

describe("useSimulationSavedStates (AOS-9031)", () => {
  const COST = { id: "rule-set-cost" };

  function item(id: string, createdAt: string) {
    return { savedStateId: id, savedStateName: `저장 ${id}`, scenarioId: "sc-1", scenarioName: "원가 인상", createdAt, ruleSetVersion: 3, runId: "r" };
  }

  function page(...items: ReturnType<typeof item>[]) {
    return ok({ savedStates: items, nextCursor: null });
  }

  it("그 Rule Set 의 최근 저장본을 받아 가장 최근 것을 고른다", async () => {
    get.mockResolvedValue(page(item("s2", "2026-11-26T02:00:00Z"), item("s1", "2026-11-26T01:00:00Z")));

    const hook = renderHook(() => useSimulationSavedStates(COST, { tenantId: "7", size: 10, refreshIntervalMs: 0 }));

    await waitFor(() => expect(hook.result.current.status).toBe("success"));
    expect(get).toHaveBeenCalledWith(
      "/simulation/saved-states",
      expect.objectContaining({ params: { ruleSetId: "rule-set-cost", size: 10 }, headers: { "X-Tenant-Id": "7" } }),
    );
    expect(hook.result.current.savedStates.map((s) => s.id)).toEqual(["s2", "s1"]);
    expect(hook.result.current.selected).toEqual({
      id: "s2",
      name: "저장 s2",
      scenarioId: "sc-1",
      scenarioName: "원가 인상",
      savedAt: "2026-11-26T02:00:00Z",
      ruleSetVersion: 3,
    });
    expect(hook.result.current.followsLatest).toBe(true);
  });

  it("다시 읽어 새 저장본이 생기면 고르지 않은 화면은 그것을 따라가고, 그동안 목록을 지우지 않는다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const next = deferred<unknown>();
      get.mockResolvedValueOnce(page(item("s1", "2026-11-26T01:00:00Z"))).mockReturnValueOnce(next.promise);
      const hook = renderHook(() => useSimulationSavedStates(COST, { tenantId: "7", refreshIntervalMs: 10_000 }));
      await waitFor(() => expect(hook.result.current.selected?.id).toBe("s1"));

      await act(async () => vi.advanceTimersByTime(10_000));

      expect(get).toHaveBeenCalledTimes(2);
      expect(hook.result.current).toMatchObject({ status: "success", savedStates: [expect.objectContaining({ id: "s1" })] });
      await act(async () => next.resolve(page(item("s2", "2026-11-26T02:00:00Z"), item("s1", "2026-11-26T01:00:00Z"))));
      expect(hook.result.current.selected?.id).toBe("s2");
    } finally {
      vi.useRealTimers();
    }
  });

  it("직접 고른 저장본은 새 저장본이 생겨도 유지하고, null 로 고르면 다시 최신을 따라간다", async () => {
    get
      .mockResolvedValueOnce(page(item("s2", "2026-11-26T02:00:00Z"), item("s1", "2026-11-26T01:00:00Z")))
      .mockResolvedValue(page(item("s3", "2026-11-26T03:00:00Z"), item("s2", "2026-11-26T02:00:00Z"), item("s1", "2026-11-26T01:00:00Z")));
    const hook = renderHook(() => useSimulationSavedStates(COST, { tenantId: "7", refreshIntervalMs: 0 }));
    await waitFor(() => expect(hook.result.current.status).toBe("success"));

    act(() => hook.result.current.select("s1"));
    act(() => hook.result.current.refetch());
    await waitFor(() => expect(hook.result.current.savedStates).toHaveLength(3));

    expect(hook.result.current).toMatchObject({ selected: expect.objectContaining({ id: "s1" }), followsLatest: false });
    act(() => hook.result.current.select(null));
    expect(hook.result.current).toMatchObject({ selected: expect.objectContaining({ id: "s3" }), followsLatest: true });
  });

  it("고른 저장본이 목록에서 빠지면 가장 최근 저장본으로 돌아간다", async () => {
    get
      .mockResolvedValueOnce(page(item("s2", "2026-11-26T02:00:00Z"), item("s1", "2026-11-26T01:00:00Z")))
      .mockResolvedValue(page(item("s2", "2026-11-26T02:00:00Z")));
    const hook = renderHook(() => useSimulationSavedStates(COST, { tenantId: "7", refreshIntervalMs: 0 }));
    await waitFor(() => expect(hook.result.current.status).toBe("success"));

    act(() => hook.result.current.select("s1"));
    act(() => hook.result.current.refetch());
    await waitFor(() => expect(hook.result.current.savedStates).toHaveLength(1));

    expect(hook.result.current).toMatchObject({ selected: expect.objectContaining({ id: "s2" }), followsLatest: true });
  });

  it("저장본이 없으면 selected 는 null 이고, 403 은 forbidden 이다", async () => {
    get.mockResolvedValueOnce(page());
    const empty = renderHook(() => useSimulationSavedStates(COST, { tenantId: "7", refreshIntervalMs: 0 }));
    await waitFor(() => expect(empty.result.current.status).toBe("success"));
    expect(empty.result.current.selected).toBeNull();

    get.mockRejectedValueOnce(httpError(403));
    const denied = renderHook(() => useSimulationSavedStates(COST, { tenantId: "7", refreshIntervalMs: 0 }));
    await waitFor(() => expect(denied.result.current.status).toBe("forbidden"));
    expect(denied.result.current).toMatchObject({ isForbidden: true, error: null, savedStates: [], selected: null });
  });

  it("화면이 가려져 있으면 다시 읽지 않는다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    try {
      get.mockResolvedValue(page(item("s1", "2026-11-26T01:00:00Z")));
      const hook = renderHook(() => useSimulationSavedStates(COST, { tenantId: "7", refreshIntervalMs: 10_000 }));
      await waitFor(() => expect(hook.result.current.status).toBe("success"));

      await act(async () => vi.advanceTimersByTime(30_000));

      expect(get).toHaveBeenCalledTimes(1);
    } finally {
      hidden.mockRestore();
      vi.useRealTimers();
    }
  });

  it("고른 저장본을 overlay 에 넘기면 그 저장본의 결과를 읽고, 바뀔 때만 다시 읽는다", async () => {
    get.mockResolvedValue(page(item("s2", "2026-11-26T02:00:00Z"), item("s1", "2026-11-26T01:00:00Z")));
    post.mockResolvedValue(ok({ items: [] }));
    const hook = renderHook(() => {
      const picker = useSimulationSavedStates(COST, { tenantId: "7", refreshIntervalMs: 0 });
      const rows = useSimulationOverlay(picker.selected, { tenantId: "7", objectType: "product" });
      return { picker, rows };
    });
    await waitFor(() => expect(hook.result.current.rows.status).toBe("success"));
    expect(post).toHaveBeenLastCalledWith("/simulation/saved-states/s2/overlay/rows", expect.anything(), expect.anything());

    act(() => hook.result.current.picker.refetch());
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(post).toHaveBeenCalledTimes(1);

    act(() => hook.result.current.picker.select("s1"));
    await waitFor(() => expect(post).toHaveBeenLastCalledWith("/simulation/saved-states/s1/overlay/rows", expect.anything(), expect.anything()));
  });

  it("다시 읽다 실패해도 이미 받은 목록과 고른 저장본을 지우지 않는다 — 결과를 다시 조회하지 않는다", async () => {
    get.mockResolvedValueOnce(page(item("s1", "2026-11-26T01:00:00Z"))).mockRejectedValueOnce(httpError(502));
    post.mockResolvedValue(ok({ items: [] }));
    const hook = renderHook(() => {
      const picker = useSimulationSavedStates(COST, { tenantId: "7", refreshIntervalMs: 0 });
      const rows = useSimulationOverlay(picker.selected, { tenantId: "7", objectType: "product" });
      return { picker, rows };
    });
    await waitFor(() => expect(hook.result.current.rows.status).toBe("success"));

    act(() => hook.result.current.picker.refetch());
    await waitFor(() => expect(hook.result.current.picker.status).toBe("error"));

    expect(hook.result.current.picker.selected?.id).toBe("s1");
    expect(hook.result.current.rows.status).toBe("success");
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("Rule Set 을 바꾸면 이전 Rule Set 의 저장본으로 결과를 조회하지 않는다", async () => {
    get.mockImplementation((_path: string, config: { params: { ruleSetId: string } }) =>
      Promise.resolve(page(item(config.params.ruleSetId === "a" ? "sa" : "sb", "2026-11-26T01:00:00Z"))),
    );
    post.mockResolvedValue(ok({ items: [] }));
    const hook = renderHook(
      ({ ruleSet }) => {
        const picker = useSimulationSavedStates(ruleSet, { tenantId: "7", refreshIntervalMs: 0 });
        return useSimulationOverlay(picker.selected, { tenantId: "7", objectType: "product" });
      },
      { initialProps: { ruleSet: { id: "a" } } },
    );
    await waitFor(() => expect(hook.result.current.status).toBe("success"));

    hook.rerender({ ruleSet: { id: "b" } });
    await waitFor(() => expect(post).toHaveBeenLastCalledWith("/simulation/saved-states/sb/overlay/rows", expect.anything(), expect.anything()));

    expect(post.mock.calls.map((c) => c[0])).toEqual([
      "/simulation/saved-states/sa/overlay/rows",
      "/simulation/saved-states/sb/overlay/rows",
    ]);
  });

  it("enabled=false 면 목록을 읽지 않고 다시 읽지도 않는다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const hook = renderHook(() => useSimulationSavedStates(COST, { tenantId: "7", refreshIntervalMs: 5_000, enabled: false }));
      await act(async () => vi.advanceTimersByTime(20_000));

      expect(get).not.toHaveBeenCalled();
      expect(hook.result.current).toMatchObject({ status: "idle", selected: null });
    } finally {
      vi.useRealTimers();
    }
  });
});
