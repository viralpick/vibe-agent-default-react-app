import { useCallback, useEffect, useState } from "react";
import { useApiClient } from "@/api/api.client";

// 시뮬레이션 저장본 결과 조회 hook (AOS-8037).
//
// 첫 인자는 `SIMULATION.<key>` 만 — 빌드 플러그인(aos-dataflow)과 앱 빌더 검사기가 그 key 로 저장본 사용을 확인한다.
// 원본과 결과를 겹치는 join · 필터 · 정렬 · 집계는 서버가 하고, 화면은 받은 값을 그리기만 한다.
// 브라우저에서 행을 다시 더하지 않는다 — 페이지 한도와 결측 처리 때문에 합계가 달라진다. 합계는 useSimulationAggregate 로.
// 조회는 reject 하지 않는다 — 실패는 status 로 알린다. 보는 사람에게 결과 읽기 권한이 없으면(403) forbidden 이다.

export interface SimulationSavedStateRef {
  /** 저장본 id (savedStateId). 다시 계산해도 바뀌지 않고, 서버가 지금 가리키는 Run 으로 읽는다 */
  id: string;
  description?: string;
}

export type SimulationResultStatus = "idle" | "running" | "success" | "error" | "forbidden";

export type SimulationOverlayPart = "SOURCE" | "VALUE" | "BASE" | "DELTA";

export interface SimulationOverlayFilter {
  /** 원본 컬럼 이름, 또는 part 를 줄 때는 겹친 Property 이름 */
  property: string;
  /** 생략하면 원본 컬럼 조건 */
  part?: SimulationOverlayPart;
  operator: string;
  values: unknown[];
}

export interface SimulationOverlaySort {
  property: string;
  part?: SimulationOverlayPart;
  direction?: "ASC" | "DESC";
}

/** 결과 칸 하나. 결과가 없는 레코드는 valueState 가 ABSENT 다 — 0 이 아니라 "—" 로 그린다 */
export interface SimulationValueCell {
  valueState: string;
  value: unknown;
  baseValueState: string;
  baseValue: unknown;
  changeState: string;
  delta?: number | null;
  deltaRate?: number | null;
  recordDisplayName?: string | null;
  [key: string]: unknown;
}

export interface SimulationOverlayRow {
  objectKey: string;
  objectKeyComponents: (string | null)[];
  /** 지금 원본 값. 칸의 baseValue(실행 때 값)와 다를 수 있다 */
  source: Record<string, unknown>;
  values: Record<string, SimulationValueCell>;
}

export interface SimulationOverlayPage {
  savedStateId: string;
  runId: string;
  objectType: string;
  properties: string[];
  keyColumns: string[];
  items: SimulationOverlayRow[];
  /** 다음 페이지가 없으면 null. 다음 페이지는 이 값을 cursor 옵션으로 넘긴다 */
  nextCursor: string | null;
  baselineSource: string;
  baselineRunId: string | null;
}

export interface SimulationAggregateResult {
  objectType: string;
  properties: string[];
  groupBy: string[];
  /** 저장본 열. 첫 인자의 순서와 같다 */
  savedStates: { savedStateId: string; runId: string; baselineSource: string; baselineRunId: string | null }[];
  groups: { groupValues: Record<string, unknown>; columns: Record<string, unknown>[] }[];
}

interface CommonOptions {
  /** `[Tenant Context]` 의 tenant_id. 모든 호출에 X-Tenant-Id 헤더로 실린다 */
  tenantId: string;
  /** 겹칠 원본 Object */
  objectType: string;
  /** 겹칠 파생 Property. 생략하면 저장본이 그 Object 에서 계산한 Property 전부 */
  properties?: string[];
  filters?: SimulationOverlayFilter[];
  /** false 면 조회하지 않는다 (예: 저장본을 아직 고르지 않았을 때) */
  enabled?: boolean;
}

export interface UseSimulationOverlayOptions extends CommonOptions {
  sort?: SimulationOverlaySort;
  /** 페이지 크기 (서버 기본 100, 최대 1,000) */
  limit?: number;
  /** 이전 응답의 nextCursor. 같은 objectType · properties · filters · sort 에서만 이어 쓴다 */
  cursor?: string | null;
}

export interface UseSimulationAggregateOptions extends CommonOptions {
  /** 묶음 원본 컬럼 (최대 3개). 생략하면 저장본마다 전체 합계 한 줄 */
  groupBy?: string[];
}

export interface SimulationResult<T> {
  data: T | null;
  status: SimulationResultStatus;
  isLoading: boolean;
  /** 보는 사람에게 결과 읽기 권한이 없다 — 오류가 아니라 "권한 없음" 상태로 그린다 */
  isForbidden: boolean;
  error: Error | null;
  /** 같은 조건으로 바로 다시 조회한다 */
  refetch: () => void;
}

interface State<T> {
  status: SimulationResultStatus;
  data: T | null;
  error: Error | null;
}

const IDLE = { status: "idle", data: null, error: null } as const;

function statusOf(cause: unknown): number | undefined {
  return (cause as { response?: { status?: number } } | null)?.response?.status;
}

function useSimulationQuery<T>(path: string, body: Record<string, unknown>, tenantId: string, enabled: boolean): SimulationResult<T> {
  const apiClient = useApiClient();
  const [state, setState] = useState<State<T>>(IDLE);
  const [nonce, setNonce] = useState(0);
  // 요청 객체는 렌더마다 새로 만들어지므로 내용으로 비교한다
  const bodyKey = JSON.stringify(body);

  useEffect(() => {
    if (!enabled) {
      setState(IDLE);
      return;
    }
    // 언마운트 · 조건 변경 때 이전 요청을 끊고, 늦게 온 응답은 버린다
    const controller = new AbortController();
    const { signal } = controller;
    setState((prev) => ({ status: "running", data: prev.data, error: null }));
    apiClient
      .post(path, JSON.parse(bodyKey), { headers: { "X-Tenant-Id": tenantId }, signal })
      .then((response) => {
        if (signal.aborted) return;
        setState({ status: "success", data: (response?.data?.data as T | undefined) ?? null, error: null });
      })
      .catch((cause: unknown) => {
        if (signal.aborted) return;
        const error = cause instanceof Error ? cause : new Error(String(cause));
        setState({ status: statusOf(cause) === 403 ? "forbidden" : "error", data: null, error });
      });
    return () => controller.abort();
  }, [apiClient, path, bodyKey, tenantId, enabled, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  return {
    data: state.data,
    status: state.status,
    isLoading: state.status === "running",
    isForbidden: state.status === "forbidden",
    error: state.error,
    refetch,
  };
}

/** 저장본 결과를 원본 레코드에 겹친 한 페이지 — `POST /simulation/saved-states/{id}/overlay/rows` */
export function useSimulationOverlay(
  savedState: SimulationSavedStateRef,
  { tenantId, objectType, properties, filters, sort, limit, cursor, enabled = true }: UseSimulationOverlayOptions,
): SimulationResult<SimulationOverlayPage> {
  return useSimulationQuery<SimulationOverlayPage>(
    `/simulation/saved-states/${savedState.id}/overlay/rows`,
    { objectType, properties, filters, sort, limit, cursor },
    tenantId,
    enabled,
  );
}

/**
 * 저장본 1~4개를 원본 컬럼으로 묶은 합계 · 변화량 · 변화율 — `POST /simulation/saved-states/overlay/aggregate`.
 * 나란히 비교하려면 첫 인자에 `[SIMULATION.a, SIMULATION.b]` 처럼 배열을 넘긴다. 열 순서가 이 순서다.
 */
export function useSimulationAggregate(
  savedStates: SimulationSavedStateRef | SimulationSavedStateRef[],
  { tenantId, objectType, properties, filters, groupBy, enabled = true }: UseSimulationAggregateOptions,
): SimulationResult<SimulationAggregateResult> {
  const savedStateIds = (Array.isArray(savedStates) ? savedStates : [savedStates]).map((s) => s.id);
  return useSimulationQuery<SimulationAggregateResult>(
    "/simulation/saved-states/overlay/aggregate",
    { savedStateIds, objectType, properties, groupBy, filters },
    tenantId,
    enabled,
  );
}
