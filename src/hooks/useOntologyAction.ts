import { useCallback, useEffect, useRef, useState } from "react";
import { useApiClient } from "@/api/api.client";

// OntologyAction 실행 hook (AOS-7001).
//
// 첫 인자는 `ACTIONS.<key>` 만 — 빌드 플러그인(aos-dataflow)과 앱 빌더 검사기가 그 key 로 액션을 추적하고 소유를 확인한다.
// 워크플로우 대기(WAITING_CALLBACK + WORKFLOW_RUN)만 끝 상태까지 조회한다. 간격 1초(10초까지) → 2초(60초까지) → 5초(5분까지) → 15초.
// 상한(기본 30분 = 실행기의 한 실행 상한)을 넘기면 실패가 아니라 waiting — 실패로 보이면 다시 눌러 두 번 실행된다.
// 실행 중(running)에 다시 부르면 새로 보내지 않고 진행 중인 Promise 를 돌려준다 — 앞 요청이 이미 서버에 닿았으면 두 번 실행되므로.
// waiting 뒤에 다시 부르면 새로 실행한다. 웹훅 대기는 끝이 없을 수 있어 막으면 다시 누를 수 없게 된다 — 막을지는 화면이 정한다.
// execute 는 reject 하지 않는다 — 결과를 받지 않는 onClick 의 실패가 프리뷰 오류로 보고되지 않게.

export interface OntologyActionRef {
  id: string;
  description?: string;
}

export type OntologyActionStatus = "idle" | "running" | "success" | "error" | "waiting";

export interface OntologyActionRun {
  id?: string;
  actionId?: string;
  actionName?: string;
  status: string;
  waitingFor?: "WORKFLOW_RUN" | "WEBHOOK" | null;
  stepResults?: unknown[];
  error?: string | null;
  [key: string]: unknown;
}

export interface UseOntologyActionOptions {
  /** `[Tenant Context]` 의 tenant_id. 모든 호출에 X-Tenant-Id 헤더로 실린다 */
  tenantId: string;
  /** 결과를 기다리는 최대 시간. 넘기면 조회만 멈추고 waiting */
  maxWaitMs?: number;
}

export interface UseOntologyActionResult {
  /** 실행하고 끝 상태(또는 waiting)까지 기다린 응답. 요청 자체가 실패하면 null. 실행 중에 다시 부르면 진행 중인 실행의 Promise */
  execute: (input?: Record<string, unknown>) => Promise<OntologyActionRun | null>;
  status: OntologyActionStatus;
  isRunning: boolean;
  data: OntologyActionRun | null;
  error: Error | null;
}

interface State {
  status: OntologyActionStatus;
  data: OntologyActionRun | null;
  error: Error | null;
}

const DEFAULT_MAX_WAIT_MS = 30 * 60 * 1000;
const MAX_POLL_FAILURES = 3;
const IDLE: State = { status: "idle", data: null, error: null };
const ABORTED = Symbol("aborted");

export function pollDelayMs(elapsedMs: number): number {
  if (elapsedMs < 10_000) return 1000;
  if (elapsedMs < 60_000) return 2000;
  if (elapsedMs < 300_000) return 5000;
  return 15_000;
}

function needsPolling(run: OntologyActionRun): boolean {
  if (run.status === "PENDING" || run.status === "RUNNING") return true;
  return run.status === "WAITING_CALLBACK" && run.waitingFor === "WORKFLOW_RUN";
}

function settledState(run: OntologyActionRun): State {
  if (run.status === "FAIL") {
    return { status: "error", data: run, error: new Error(run.error || "액션 실행에 실패했습니다") };
  }
  if (run.status === "WAITING_CALLBACK") return { status: "waiting", data: run, error: null };
  return { status: "success", data: run, error: null };
}

function runOf(response: { data?: { data?: unknown } } | undefined): OntologyActionRun {
  const run = response?.data?.data as OntologyActionRun | undefined;
  if (!run || typeof run.status !== "string") throw new Error("액션 실행 응답에 상태가 없습니다");
  return run;
}

function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T | typeof ABORTED> {
  if (signal.aborted) return Promise.resolve(ABORTED);
  return new Promise((resolve, reject) => {
    const onAbort = () => resolve(ABORTED);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(signal.aborted ? ABORTED : value);
      },
      (cause: unknown) => {
        signal.removeEventListener("abort", onAbort);
        if (signal.aborted) resolve(ABORTED);
        else reject(cause);
      },
    );
  });
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** 바깥 signal 이 끊기거나 ms 가 지나면 끊기는 signal — 상한을 넘긴 조회 요청을 기다리지 않게 */
function withDeadline(signal: AbortSignal, ms: number): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, Math.max(ms, 0));
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    },
  };
}

export function useOntologyAction(
  action: OntologyActionRef,
  { tenantId, maxWaitMs = DEFAULT_MAX_WAIT_MS }: UseOntologyActionOptions,
): UseOntologyActionResult {
  const apiClient = useApiClient();
  const [state, setState] = useState<State>(IDLE);
  const controllerRef = useRef<AbortController | null>(null);
  const inflightRef = useRef<Promise<OntologyActionRun | null> | null>(null);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    },
    [],
  );

  const runAction = useCallback(
    async (input?: Record<string, unknown>): Promise<OntologyActionRun | null> => {
      const controller = new AbortController();
      controllerRef.current = controller;
      const { signal } = controller;
      const config = { headers: { "X-Tenant-Id": tenantId }, signal };
      const update = (next: State) => {
        if (!signal.aborted) setState(next);
      };
      const startedAt = Date.now();

      update({ status: "running", data: null, error: null });

      let run: OntologyActionRun;
      try {
        const response = await abortable(
          apiClient.post(`/ontology-actions/${action.id}/runs`, { input: input ?? {} }, config),
          signal,
        );
        if (response === ABORTED) return null;
        run = runOf(response);
      } catch (cause) {
        update({ status: "error", data: null, error: toError(cause) });
        return null;
      }

      let failures = 0;
      const pastDeadline = () => Date.now() - startedAt >= maxWaitMs;
      while (needsPolling(run) && run.id) {
        const elapsed = Date.now() - startedAt;
        if (elapsed >= maxWaitMs) break;
        update({ status: "running", data: run, error: null });
        await sleep(Math.min(pollDelayMs(elapsed), maxWaitMs - elapsed), signal);
        if (signal.aborted) return run;
        if (pastDeadline()) break;
        const poll = withDeadline(signal, maxWaitMs - (Date.now() - startedAt));
        try {
          const response = await abortable(
            apiClient.get(`/ontology-actions/${action.id}/runs/${run.id}`, { ...config, signal: poll.signal }),
            poll.signal,
          );
          if (response === ABORTED) {
            if (signal.aborted) return run;
            break;
          }
          run = runOf(response);
          failures = 0;
        } catch (cause) {
          if (pastDeadline()) break;
          failures += 1;
          if (failures >= MAX_POLL_FAILURES) {
            update({ status: "error", data: run, error: toError(cause) });
            return run;
          }
        } finally {
          poll.dispose();
        }
      }

      if (needsPolling(run)) update({ status: "waiting", data: run, error: null });
      else update(settledState(run));
      return run;
    },
    [apiClient, action.id, tenantId, maxWaitMs],
  );

  const execute = useCallback(
    (input?: Record<string, unknown>): Promise<OntologyActionRun | null> => {
      if (inflightRef.current) return inflightRef.current;
      const promise = runAction(input).finally(() => {
        if (inflightRef.current === promise) inflightRef.current = null;
      });
      inflightRef.current = promise;
      return promise;
    },
    [runAction],
  );

  return {
    execute,
    status: state.status,
    isRunning: state.status === "running",
    data: state.data,
    error: state.error,
  };
}
