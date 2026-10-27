import { act, render, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearOntologyFunctionCache, useOntologyFunction } from "./useOntologyFunction";

const post = vi.fn();
vi.mock("@/api/api.client", () => ({ useApiClient: () => ({ post }) }));

const SALES = { id: "fn-sales" };

function respond(rows: unknown[]) {
  return { data: { data: { result: rows } } };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  clearOntologyFunctionCache();
  post.mockReset();
});

describe("useOntologyFunction", () => {
  it("같은 함수를 부르는 컴포넌트가 여럿이어도 요청은 한 번만 나간다", async () => {
    post.mockResolvedValue(respond([{ total: 1 }]));
    const seen: unknown[][] = [];
    function Widget() {
      const { data } = useOntologyFunction(SALES, { tenantId: "7" });
      seen.push(data);
      return null;
    }

    render(
      <>
        <Widget />
        <Widget />
        <Widget />
      </>,
    );

    await waitFor(() => expect(seen.at(-1)).toEqual([{ total: 1 }]));
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("파라미터가 다르면 따로 조회한다", async () => {
    post.mockResolvedValue(respond([]));
    renderHook(() => useOntologyFunction(SALES, { tenantId: "7", parameters: { month: 1 } }));
    renderHook(() => useOntologyFunction(SALES, { tenantId: "7", parameters: { month: 2 } }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  });

  it("캐시가 있으면 바로 보여 주고 오래됐으면 뒤에서 다시 조회한다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      post.mockResolvedValueOnce(respond([{ total: 1 }]));
      const first = renderHook(() => useOntologyFunction(SALES, { tenantId: "7" }));
      await waitFor(() => expect(first.result.current.data).toEqual([{ total: 1 }]));
      first.unmount();

      vi.advanceTimersByTime(5000);
      const next = deferred<unknown>();
      post.mockReturnValueOnce(next.promise);
      const second = renderHook(() => useOntologyFunction(SALES, { tenantId: "7" }));

      expect(second.result.current.data).toEqual([{ total: 1 }]);
      expect(second.result.current.isLoading).toBe(false);
      expect(post).toHaveBeenCalledTimes(2);

      await act(async () => next.resolve(respond([{ total: 2 }])));
      expect(second.result.current.data).toEqual([{ total: 2 }]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("refetch 는 바로 다시 조회하고 같은 함수를 쓰는 모든 hook 에 반영한다", async () => {
    post.mockResolvedValueOnce(respond([{ total: 1 }]));
    const a = renderHook(() => useOntologyFunction(SALES, { tenantId: "7" }));
    const b = renderHook(() => useOntologyFunction(SALES, { tenantId: "7" }));
    await waitFor(() => expect(b.result.current.data).toEqual([{ total: 1 }]));

    post.mockResolvedValueOnce(respond([{ total: 9 }]));
    act(() => a.result.current.refetch());

    await waitFor(() => expect(b.result.current.data).toEqual([{ total: 9 }]));
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("다시 조회가 실패해도 이전 결과는 남기고 error 로 알린다", async () => {
    post.mockResolvedValueOnce(respond([{ total: 1 }]));
    const { result } = renderHook(() => useOntologyFunction(SALES, { tenantId: "7" }));
    await waitFor(() => expect(result.current.data).toEqual([{ total: 1 }]));

    post.mockRejectedValueOnce(new Error("boom"));
    act(() => result.current.refetch());

    await waitFor(() => expect(result.current.error?.message).toBe("boom"));
    expect(result.current.data).toEqual([{ total: 1 }]);
  });

  it("늦게 온 이전 응답이 새 결과를 덮어쓰지 않는다", async () => {
    const slow = deferred<unknown>();
    post.mockReturnValueOnce(slow.promise);
    const { result } = renderHook(() => useOntologyFunction(SALES, { tenantId: "7" }));

    post.mockResolvedValueOnce(respond([{ total: 2 }]));
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.data).toEqual([{ total: 2 }]));

    await act(async () => slow.resolve(respond([{ total: 1 }])));
    expect(result.current.data).toEqual([{ total: 2 }]);
  });

  it("enabled 가 false 면 조회하지 않는다", () => {
    const { result } = renderHook(() =>
      useOntologyFunction(SALES, { tenantId: "7", enabled: false }),
    );
    expect(post).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ data: [], isLoading: false, error: null });
  });

  it("처음 받기 전에는 isLoading 이고, 행이 아닌 값은 걸러 낸다", async () => {
    post.mockResolvedValue(respond([{ total: 1 }, null, 3]));
    const { result } = renderHook(() => useOntologyFunction(SALES, { tenantId: "7" }));
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([{ total: 1 }]);
  });
});
