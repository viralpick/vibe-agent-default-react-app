import { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type OntologyActionRun, useOntologyAction } from "./useOntologyAction";

const post = vi.fn();
const get = vi.fn();
vi.mock("@/api/api.client", () => ({ useApiClient: () => ({ post, get }) }));

const APPROVE = { id: "act-1" };
const RUNS = "/ontology-actions/act-1/runs";
const POLL = "/ontology-actions/act-1/runs/run-1";

function respond(status: string, extra: Record<string, unknown> = {}) {
  return { data: { data: { id: "run-1", status, ...extra } } };
}
const workflowWait = () => respond("WAITING_CALLBACK", { waitingFor: "WORKFLOW_RUN" });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function mount(options: { maxWaitMs?: number; wrapper?: typeof StrictMode } = {}) {
  const { wrapper, ...rest } = options;
  return renderHook(() => useOntologyAction(APPROVE, { tenantId: "7", ...rest }), { wrapper });
}

type Hook = ReturnType<typeof mount>;

function start(hook: Hook, input?: Record<string, unknown>): Promise<OntologyActionRun | null> {
  let promise!: Promise<OntologyActionRun | null>;
  act(() => {
    promise = hook.result.current.execute(input);
  });
  return promise;
}

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  post.mockReset();
  get.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useOntologyAction", () => {
  it("실행 전에는 idle 이다", () => {
    const hook = mount();
    expect(hook.result.current).toMatchObject({ status: "idle", isRunning: false, data: null, error: null });
  });

  it("바로 끝난 응답은 조회 없이 그대로 쓴다", async () => {
    post.mockResolvedValue(respond("SUCCESS"));
    const hook = mount();

    const run = await act(() => hook.result.current.execute({ order: 3 }));

    expect(post).toHaveBeenCalledWith(
      RUNS,
      { input: { order: 3 } },
      expect.objectContaining({ headers: { "X-Tenant-Id": "7" } }),
    );
    expect(get).not.toHaveBeenCalled();
    expect(run?.status).toBe("SUCCESS");
    expect(hook.result.current).toMatchObject({ status: "success", isRunning: false, data: { status: "SUCCESS" } });
  });

  it("워크플로우 대기면 끝 상태까지 조회해 결과를 돌려준다", async () => {
    post.mockResolvedValue(workflowWait());
    get.mockResolvedValueOnce(respond("RUNNING")).mockResolvedValueOnce(respond("SUCCESS"));
    const hook = mount();

    const promise = start(hook);
    await tick(0);
    expect(hook.result.current.isRunning).toBe(true);

    await tick(1000);
    expect(get).toHaveBeenCalledTimes(1);
    expect(hook.result.current.status).toBe("running");

    await tick(1000);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenCalledWith(POLL, expect.objectContaining({ headers: { "X-Tenant-Id": "7" } }));
    expect((await promise)?.status).toBe("SUCCESS");
    expect(hook.result.current).toMatchObject({ status: "success", data: { status: "SUCCESS" } });
  });

  it("조회 끝이 FAIL 이면 서버 error 문구로 error 가 된다", async () => {
    post.mockResolvedValue(workflowWait());
    get.mockResolvedValue(respond("FAIL", { error: "재고가 부족합니다" }));
    const hook = mount();

    const promise = start(hook);
    await tick(1000);

    expect((await promise)?.status).toBe("FAIL");
    expect(hook.result.current.status).toBe("error");
    expect(hook.result.current.error?.message).toBe("재고가 부족합니다");
  });

  it("웹훅 대기는 조회하지 않고 waiting 이다", async () => {
    post.mockResolvedValue(respond("WAITING_CALLBACK", { waitingFor: "WEBHOOK" }));
    const hook = mount();

    const promise = start(hook);
    await tick(60_000);

    expect(get).not.toHaveBeenCalled();
    expect((await promise)?.waitingFor).toBe("WEBHOOK");
    expect(hook.result.current.status).toBe("waiting");
  });

  it("무엇을 기다리는지 없는 WAITING_CALLBACK 도 조회하지 않는다", async () => {
    post.mockResolvedValue(respond("WAITING_CALLBACK"));
    const hook = mount();

    start(hook);
    await tick(60_000);

    expect(get).not.toHaveBeenCalled();
    expect(hook.result.current.status).toBe("waiting");
  });

  it("언마운트하면 조회를 멈추고 execute 는 마지막 응답으로 끝난다", async () => {
    post.mockResolvedValue(workflowWait());
    get.mockResolvedValue(respond("RUNNING"));
    const hook = mount();

    const promise = start(hook);
    await tick(1000);
    expect(get).toHaveBeenCalledTimes(1);

    hook.unmount();
    await tick(60_000);

    expect(get).toHaveBeenCalledTimes(1);
    expect((await promise)?.status).toBe("RUNNING");
  });

  it("조회 간격은 10초까지 1초, 60초까지 2초, 그 뒤 5초다", async () => {
    post.mockResolvedValue(workflowWait());
    get.mockResolvedValue(respond("RUNNING"));
    const hook = mount();

    start(hook);
    await tick(10_000);
    expect(get).toHaveBeenCalledTimes(10);
    await tick(50_000);
    expect(get).toHaveBeenCalledTimes(35);
    await tick(50_000);
    expect(get).toHaveBeenCalledTimes(45);
  });

  it("상한을 넘기면 조회만 멈추고 waiting 으로 둔다", async () => {
    post.mockResolvedValue(workflowWait());
    get.mockResolvedValue(respond("RUNNING"));
    const hook = mount({ maxWaitMs: 5000 });

    const promise = start(hook);
    await tick(10_000);

    expect(get).toHaveBeenCalledTimes(4);
    expect((await promise)?.status).toBe("RUNNING");
    expect(hook.result.current).toMatchObject({ status: "waiting", error: null });

    await tick(60_000);
    expect(get).toHaveBeenCalledTimes(4);
  });

  it("상한을 지나서는 조회를 시작하지 않아 실패가 이어져도 error 가 아니라 waiting 이다", async () => {
    post.mockResolvedValue(workflowWait());
    get.mockRejectedValue(new Error("502"));
    const hook = mount({ maxWaitMs: 2500 });

    const promise = start(hook);
    await tick(10_000);

    expect(get).toHaveBeenCalledTimes(2);
    expect((await promise)?.status).toBe("WAITING_CALLBACK");
    expect(hook.result.current).toMatchObject({ status: "waiting", error: null });
  });

  it("조회가 중간에 실패해도 성공하면 다시 세고, 결국 끝 상태를 받는다", async () => {
    post.mockResolvedValue(workflowWait());
    get
      .mockRejectedValueOnce(new Error("502"))
      .mockResolvedValueOnce(respond("RUNNING"))
      .mockRejectedValueOnce(new Error("502"))
      .mockRejectedValueOnce(new Error("502"))
      .mockResolvedValueOnce(respond("SUCCESS"));
    const hook = mount();

    const promise = start(hook);
    await tick(5000);

    expect(get).toHaveBeenCalledTimes(5);
    expect((await promise)?.status).toBe("SUCCESS");
    expect(hook.result.current.status).toBe("success");
  });

  it("조회가 연달아 3번 실패하면 error 다", async () => {
    post.mockResolvedValue(workflowWait());
    get.mockRejectedValue(new Error("502"));
    const hook = mount();

    const promise = start(hook);
    await tick(10_000);

    expect(get).toHaveBeenCalledTimes(3);
    expect((await promise)?.status).toBe("WAITING_CALLBACK");
    expect(hook.result.current.status).toBe("error");
    expect(hook.result.current.error?.message).toBe("502");
  });

  it("조회 중 웹훅 대기로 바뀌면 더 조회하지 않고 waiting 이다", async () => {
    post.mockResolvedValue(workflowWait());
    get.mockResolvedValue(respond("WAITING_CALLBACK", { waitingFor: "WEBHOOK" }));
    const hook = mount();

    start(hook);
    await tick(60_000);

    expect(get).toHaveBeenCalledTimes(1);
    expect(hook.result.current).toMatchObject({ status: "waiting", data: { waitingFor: "WEBHOOK" } });
  });

  it("실행 요청이 실패하면 null 을 돌려주고 reject 하지 않는다", async () => {
    post.mockRejectedValue(new Error("403"));
    const hook = mount();

    const run = await act(() => hook.result.current.execute());

    expect(run).toBeNull();
    expect(hook.result.current).toMatchObject({ status: "error", data: null });
    expect(hook.result.current.error?.message).toBe("403");
  });

  it("잇기 전 액션 샘플 응답(SUCCEEDED)은 success 다", async () => {
    post.mockResolvedValue({ data: { data: { status: "SUCCEEDED", unbound: true } } });
    const hook = mount();

    await act(() => hook.result.current.execute());

    expect(get).not.toHaveBeenCalled();
    expect(hook.result.current.status).toBe("success");
  });

  it("다시 실행하면 이전 조회를 멈추고 새 실행만 반영한다", async () => {
    post.mockResolvedValueOnce(workflowWait());
    get.mockResolvedValue(respond("RUNNING"));
    const hook = mount();

    const first = start(hook);
    await tick(1000);
    expect(get).toHaveBeenCalledTimes(1);

    post.mockResolvedValueOnce(respond("SUCCESS", { id: "run-2" }));
    await act(() => hook.result.current.execute());
    await tick(60_000);

    expect(get).toHaveBeenCalledTimes(1);
    expect((await first)?.status).toBe("RUNNING");
    expect(hook.result.current).toMatchObject({ status: "success", data: { id: "run-2" } });
  });

  it("실행 응답이 오기 전 언마운트하면 늦게 온 응답으로 조회하지 않는다", async () => {
    const slow = deferred<unknown>();
    post.mockReturnValue(slow.promise);
    const hook = mount();

    const promise = start(hook);
    hook.unmount();
    slow.resolve(workflowWait());
    await tick(60_000);

    expect(await promise).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it("조회 응답이 오기 전 다시 실행하면 늦게 온 응답이 상태를 바꾸지 않는다", async () => {
    const slow = deferred<unknown>();
    post.mockResolvedValueOnce(workflowWait());
    get.mockReturnValueOnce(slow.promise);
    const hook = mount();

    start(hook);
    await tick(1000);
    expect(get).toHaveBeenCalledTimes(1);

    post.mockResolvedValueOnce(respond("SUCCESS", { id: "run-2" }));
    await act(() => hook.result.current.execute());
    await act(async () => slow.resolve(respond("FAIL", { error: "늦은 응답" })));
    await tick(60_000);

    expect(get).toHaveBeenCalledTimes(1);
    expect(hook.result.current).toMatchObject({ status: "success", error: null, data: { id: "run-2" } });
  });

  it("응답이 오지 않는 조회 중 언마운트하면 요청을 끊고 바로 끝난다", async () => {
    post.mockResolvedValue(workflowWait());
    get.mockReturnValue(new Promise(() => {}));
    const hook = mount();

    const promise = start(hook);
    await tick(1000);
    const signal = (get.mock.calls[0][1] as { signal: AbortSignal }).signal;
    expect(signal.aborted).toBe(false);

    hook.unmount();

    expect(signal.aborted).toBe(true);
    expect((await promise)?.status).toBe("WAITING_CALLBACK");
  });

  it("StrictMode 의 마운트→해제→마운트 뒤에도 실행·조회한다", async () => {
    post.mockResolvedValue(workflowWait());
    get.mockResolvedValue(respond("SUCCESS"));
    const hook = mount({ wrapper: StrictMode });

    const promise = start(hook);
    await tick(1000);

    expect(get).toHaveBeenCalledTimes(1);
    expect((await promise)?.status).toBe("SUCCESS");
    expect(hook.result.current.status).toBe("success");
  });
});
