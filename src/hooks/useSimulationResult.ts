import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApiClient } from "@/api/api.client";

// 시뮬레이션 저장본 결과 조회 hook (AOS-8037).
//
// 첫 인자는 `SIMULATION.<key>` 만 — 빌드 플러그인(aos-dataflow)과 앱 빌더 검사기가 그 key 로 저장본 사용을 확인한다.
// 원본과 결과를 겹치는 join · 필터 · 정렬 · 집계는 서버가 하고, 화면은 받은 값을 그리기만 한다.
// 브라우저에서 행을 다시 더하지 않는다 — 페이지 한도와 결측 처리 때문에 합계가 달라진다. 합계는 useSimulationAggregate 로.
// 조회는 reject 하지 않는다 — 실패는 status 로 알린다. 보는 사람에게 결과 읽기 권한이 없으면(403) forbidden 이다.
// 상수에 없는 key(undefined)로 불러도 렌더에서 던지지 않는다 — 요청이 실패해 error 가 된다.
//
// 저장본을 앱에서 고르게 하려면 (AOS-9031) `useSimulationSavedStates(SIMULATION_RULE_SETS.<key>)` 로 그 Rule Set 의
// 저장본 목록을 받고, 그 결과의 `selected` 를 overlay · aggregate hook 의 첫 인자로 넘긴다. 목록은 주기적으로 다시 읽어
// 새로 저장한 결과가 나타나고, 사용자가 직접 고르지 않았으면 가장 최근 저장본을 따라간다.
// 사용자는 Scenario 를 먼저 고른다 (AOS-9131) — `useSimulationScenarios(SIMULATION_RULE_SETS.<key>)` 의 Scenario id 를
// `useSimulationSavedStates` 의 scenarioId 옵션으로 넘긴다. 비교 열마다 이 한 쌍을 둔다.
// `selected` 가 아직 없으면(null) 결과 hook 은 조회하지 않고 idle 이다.

export interface SimulationSavedStateRef {
  /** 저장본 id (savedStateId). 다시 계산해도 바뀌지 않고, 서버가 지금 가리키는 Run 으로 읽는다 */
  id: string;
  description?: string;
}

/**
 * 저장본을 고를 Rule Set. 고를 수 있는 Scenario 의 범위다. 같은 Rule Set 이어도 Scenario 마다 계산한 Object 가 다를 수 있다 —
 * 앱이 읽는 Object 를 계산하지 않은 저장본은 결과 hook 이 400(OVERLAY_INVALID_REQUEST) error 다
 */
export interface SimulationRuleSetRef {
  /** Rule Set id (ruleSetId) */
  id: string;
  description?: string;
}

/** 목록의 저장본 한 개. 그대로 overlay · aggregate hook 의 첫 인자로 넘긴다 */
export interface SimulationSavedStateSummary extends SimulationSavedStateRef {
  /** 저장할 때 붙인 이름. 없을 수 있고 유일하지 않다 */
  name: string | null;
  /** Scenario 안에서의 저장 순번 (1부터). 이름이 없을 때 `저장 #3` 처럼 구별한다 — 다른 Scenario 의 순번과는 겹친다 */
  sequenceNo: number;
  scenarioId: string;
  scenarioName: string;
  /** 저장한 시각 (ISO-8601) */
  savedAt: string;
  ruleSetVersion: number;
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
  /**
   * 겹칠 파생 Property. 생략하면 저장본이 그 Object 에서 계산한 Property 전부다.
   * 묶음 합계는 첫 저장본 기준이고, 나머지 저장본도 그 Property 를 모두 계산했어야 한다
   */
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
  /** status 가 error 일 때만 있다. forbidden 이면 null 이라 `if (error)` 로 그린 화면이 권한 없음을 오류로 보이지 않는다 */
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
    setState({ status: "running", data: null, error: null });
    apiClient
      .post(path, JSON.parse(bodyKey), { headers: { "X-Tenant-Id": tenantId }, signal })
      .then((response) => {
        if (signal.aborted) return;
        setState({ status: "success", data: (response?.data?.data as T | undefined) ?? null, error: null });
      })
      .catch((cause: unknown) => {
        if (signal.aborted) return;
        if (statusOf(cause) === 403) {
          setState({ status: "forbidden", data: null, error: null });
          return;
        }
        setState({ status: "error", data: null, error: cause instanceof Error ? cause : new Error(String(cause)) });
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
  savedState: SimulationSavedStateRef | null,
  { tenantId, objectType, properties, filters, sort, limit, cursor, enabled = true }: UseSimulationOverlayOptions,
): SimulationResult<SimulationOverlayPage> {
  return useSimulationQuery<SimulationOverlayPage>(
    `/simulation/saved-states/${savedState?.id}/overlay/rows`,
    { objectType, properties, filters, sort, limit, cursor },
    tenantId,
    enabled && savedState !== null,
  );
}

/**
 * 저장본 1~4개를 원본 컬럼으로 묶은 합계 · 변화량 · 변화율 — `POST /simulation/saved-states/overlay/aggregate`.
 * 나란히 비교하려면 첫 인자에 `[SIMULATION.a, SIMULATION.b]` 처럼 배열을 넘긴다. 열 순서가 이 순서다.
 * 같은 저장본이 두 번 들어 있으면(두 열이 같은 저장본을 고름) 서버가 거절하므로 조회하지 않고, 그 이유를 담은 error 다.
 */
export function useSimulationAggregate(
  savedStates: SimulationSavedStateRef | null | (SimulationSavedStateRef | null)[],
  { tenantId, objectType, properties, filters, groupBy, enabled = true }: UseSimulationAggregateOptions,
): SimulationResult<SimulationAggregateResult> {
  const refs = Array.isArray(savedStates) ? savedStates : [savedStates];
  const savedStateIds = refs.map((s) => s?.id);
  const ready = enabled && !refs.includes(null);
  const distinct = new Set(savedStateIds).size === savedStateIds.length;
  const result = useSimulationQuery<SimulationAggregateResult>(
    "/simulation/saved-states/overlay/aggregate",
    { savedStateIds, objectType, properties, groupBy, filters },
    tenantId,
    ready && distinct,
  );
  if (ready && !distinct) return { ...result, data: null, status: "error", isLoading: false, isForbidden: false, error: DUPLICATE_SAVED_STATES };
  return result;
}

const DUPLICATE_SAVED_STATES = new Error("같은 저장본을 두 번 골랐습니다. 열마다 다른 저장본을 고르세요.");

export interface UseSimulationSavedStatesOptions {
  /** `[Tenant Context]` 의 tenant_id. 모든 호출에 X-Tenant-Id 헤더로 실린다 */
  tenantId: string;
  /**
   * 이 Scenario 의 저장본만 받는다 (서버가 좁힌다). 비교 열마다 `useSimulationScenarios` 로 고른 Scenario id 를 넘긴다.
   * null 이나 빈 문자열(`<option value="">` 의 값)이면 아직 고르지 않은 것이다 — 조회하지 않고 selected 가 null 이다.
   * 생략하면 Rule Set 의 모든 Scenario 저장본이 섞인다
   */
  scenarioId?: string | null;
  /** 최근 몇 개를 받을지 (기본 20, 최대 100). 최신순이다 */
  size?: number;
  /** 목록을 다시 읽는 간격 (기본 30초, 최소 5초). 0 이면 다시 읽지 않는다. 화면이 가려져 있거나 forbidden 이면 건너뛴다 */
  refreshIntervalMs?: number;
  /** false 면 조회하지 않는다 */
  enabled?: boolean;
}

export interface SimulationSavedStatePicker {
  /** 그 Rule Set(scenarioId 를 주면 그 Scenario)의 최근 저장본, 최신순 */
  savedStates: SimulationSavedStateSummary[];
  /** 고른 저장본. 직접 고르지 않았으면 가장 최근 저장본이고, 목록이 비었거나 Scenario 를 아직 고르지 않았으면 null 이다 */
  selected: SimulationSavedStateSummary | null;
  /** 저장본을 고른다. null 이면 다시 가장 최근 저장본을 따라간다. Scenario 를 바꾸면 고른 것은 풀리고 그 Scenario 의 최신을 따라간다 */
  select: (savedStateId: string | null) => void;
  /** 새 저장본이 생기면 selected 가 그것으로 바뀌는가 (직접 고르지 않은 상태) */
  followsLatest: boolean;
  /**
   * 목록 조회 상태. 다시 읽는 동안에는 바뀌지 않는다. 다시 읽다 실패하면 error 지만 이미 받은 목록과 selected 는 그대로 둔다
   * (결과를 다시 조회하지 않는다). forbidden 이면 목록을 비운다
   */
  status: SimulationResultStatus;
  isLoading: boolean;
  isForbidden: boolean;
  error: Error | null;
  /** 바로 다시 읽는다 */
  refetch: () => void;
}

interface CatalogItem {
  savedStateId: string;
  savedStateName: string | null;
  sequenceNo: number;
  scenarioId: string;
  scenarioName: string;
  createdAt: string;
  ruleSetVersion: number;
}

const DEFAULT_REFRESH_MS = 30_000;
const MIN_REFRESH_MS = 5_000;

interface PolledList<T> {
  data: T | null;
  status: SimulationResultStatus;
  error: Error | null;
  refetch: () => void;
}

/**
 * 목록을 GET 으로 받고 주기적으로 다시 읽는다. 같은 조회(key)를 다시 읽는 동안에는 이전 상태를 그대로 두고, 실패해도 받은 목록은 남긴다.
 * key 가 바뀐 첫 렌더에는 이전 조회의 상태를 내지 않는다
 */
function usePolledList<T>(
  path: string,
  params: Record<string, unknown>,
  key: string,
  tenantId: string,
  enabled: boolean,
  refreshIntervalMs: number,
  read: (body: unknown) => T,
): PolledList<T> {
  const apiClient = useApiClient();
  const [state, setState] = useState<State<T> & { key: string | null }>({ ...IDLE, key: null });
  const [nonce, setNonce] = useState(0);
  // 다시 읽기 차례가 와도 앞 요청이 아직 오지 않았으면 건너뛴다 — 끊고 다시 보내면 응답이 간격보다 느린 환경에서 목록을 영영 받지 못한다
  const inFlight = useRef(false);
  const paramsKey = JSON.stringify(params);
  const readRef = useRef(read);
  readRef.current = read;

  useEffect(() => {
    if (!enabled) {
      setState({ ...IDLE, key: null });
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;
    // 같은 조회를 다시 읽을 때는 이전 상태(목록 · 권한 없음 · 오류)를 그대로 둔다 — 몇 초마다 화면이 로딩으로 깜박이게 된다
    setState((prev) => (prev.key === key && prev.status !== "idle" ? prev : { status: "running", data: null, error: null, key }));
    inFlight.current = true;
    apiClient
      .get(path, { params: JSON.parse(paramsKey), headers: { "X-Tenant-Id": tenantId }, signal })
      .finally(() => {
        if (!signal.aborted) inFlight.current = false;
      })
      .then((response) => {
        if (signal.aborted) return;
        setState({ status: "success", data: readRef.current(response?.data?.data), error: null, key });
      })
      .catch((cause: unknown) => {
        if (signal.aborted) return;
        if (statusOf(cause) === 403) {
          setState({ status: "forbidden", data: null, error: null, key });
          return;
        }
        const error = cause instanceof Error ? cause : new Error(String(cause));
        // 일시 오류로 목록을 지우면 그 목록으로 고른 값(저장본 · Scenario)이 사라졌다가 다음 성공에 돌아온다 — 받은 목록은 남긴다
        setState((prev) => ({ status: "error", data: prev.key === key ? prev.data : null, error, key }));
      });
    return () => {
      controller.abort();
      inFlight.current = false;
    };
  }, [apiClient, path, paramsKey, key, tenantId, enabled, nonce]);

  // 권한이 없으면 주기적으로 다시 읽어도 결과가 같다 — 다시 읽기는 refetch 나 조회 조건이 바뀔 때만 한다
  const forbidden = state.key === key && state.status === "forbidden";

  useEffect(() => {
    if (!enabled || forbidden || refreshIntervalMs <= 0) return;
    const timer = setInterval(() => {
      if (inFlight.current || (typeof document !== "undefined" && document.hidden)) return;
      setNonce((n) => n + 1);
    }, Math.max(refreshIntervalMs, MIN_REFRESH_MS));
    return () => clearInterval(timer);
  }, [enabled, forbidden, refreshIntervalMs]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  const current = state.key === key;
  return {
    data: current ? state.data : null,
    // 조회 조건이 바뀐 첫 렌더에는 이전 조회의 상태를 내지 않는다
    status: current ? state.status : enabled ? "running" : "idle",
    error: current ? state.error : null,
    refetch,
  };
}

/**
 * Rule Set 하나의 최근 저장본 목록과 고른 저장본 — `GET /simulation/saved-states?ruleSetId=…[&scenarioId=…]`.
 * 시나리오 화면에서 가정을 고쳐 저장하면 다음 다시 읽기에 목록 맨 위에 나타난다.
 */
export function useSimulationSavedStates(
  ruleSet: SimulationRuleSetRef,
  { tenantId, scenarioId, size = 20, refreshIntervalMs = DEFAULT_REFRESH_MS, enabled = true }: UseSimulationSavedStatesOptions,
): SimulationSavedStatePicker {
  const ruleSetId = ruleSet?.id;
  const queryEnabled = enabled && scenarioId !== null && scenarioId !== "";
  // 목록이 어느 조회의 것인지 함께 든다 — Rule Set · Scenario 가 바뀐 첫 렌더에 이전 조회의 저장본을 selected 로 내지 않는다
  const key = `${tenantId}|${ruleSetId}|${scenarioId ?? "*"}`;
  const params = scenarioId ? { ruleSetId, scenarioId, size } : { ruleSetId, size };
  const list = usePolledList("/simulation/saved-states", params, key, tenantId, queryEnabled, refreshIntervalMs, (body) =>
    (((body as { savedStates?: CatalogItem[] } | undefined)?.savedStates) ?? []).map(toSummary),
  );
  // 고른 것도 어느 조회에서 고른 것인지 함께 든다. 조회가 바뀌면 고른 것을 버린다 — Scenario 를 바꿨다 돌아와도 그 Scenario 의 최신을 따라간다
  const [chosen, setChosen] = useState<{ key: string; id: string } | null>(null);
  if (chosen !== null && chosen.key !== key) setChosen(null);
  const select = useCallback((savedStateId: string | null) => setChosen(savedStateId === null ? null : { key, id: savedStateId }), [key]);

  const savedStates = useMemo(() => list.data ?? [], [list.data]);
  // 고른 저장본이 목록에서 빠지면(지워졌거나 최근 size 개 밖으로 밀려남) 가장 최근 저장본으로 돌아간다
  const chosenItem = chosen?.key === key ? savedStates.find((item) => item.id === chosen.id) : undefined;
  const selected = chosenItem ?? savedStates[0] ?? null;

  return {
    savedStates,
    selected,
    select,
    followsLatest: chosenItem === undefined,
    status: list.status,
    isLoading: list.status === "running",
    isForbidden: list.status === "forbidden",
    error: list.error,
    refetch: list.refetch,
  };
}

/** Rule Set 의 저장본을 가진 Scenario 하나. id 를 `useSimulationSavedStates` 의 scenarioId 옵션으로 넘긴다 */
export interface SimulationScenarioSummary {
  id: string;
  name: string;
  /** ACTIVE · DISCARDED. 폐기된 Scenario 의 저장본도 열 수 있다 — 표시로 구별한다 */
  status: string;
  /** 이 Rule Set 의 저장본 수 */
  savedStateCount: number;
  /** 이 Rule Set 의 저장본 중 가장 최근 저장 시각 (ISO-8601) */
  latestSavedAt: string;
}

export interface UseSimulationScenariosOptions {
  /** `[Tenant Context]` 의 tenant_id. 모든 호출에 X-Tenant-Id 헤더로 실린다 */
  tenantId: string;
  /** 목록을 다시 읽는 간격 (기본 30초, 최소 5초). 0 이면 다시 읽지 않는다 */
  refreshIntervalMs?: number;
  enabled?: boolean;
}

export interface SimulationScenarioList {
  /** 마지막 저장 시각 내림차순 (최대 100) */
  scenarios: SimulationScenarioSummary[];
  /** 100 개를 넘어 마지막 저장이 오래된 Scenario 가 빠졌다 */
  truncated: boolean;
  status: SimulationResultStatus;
  isLoading: boolean;
  isForbidden: boolean;
  error: Error | null;
  refetch: () => void;
}

interface ScenarioItem {
  scenarioId: string;
  scenarioName: string;
  scenarioStatus: string;
  savedStateCount: number;
  latestSavedAt: string;
}

/**
 * Rule Set 의 저장본을 가진 Scenario 목록 — `GET /simulation/saved-states/scenarios?ruleSetId=…`.
 * 비교 열마다 여기서 Scenario 를 고르고, 그 id 를 `useSimulationSavedStates` 의 scenarioId 로 넘겨 그 Scenario 의 저장본을 고른다.
 * 저장본 목록에서 Scenario 를 모으지 않는다 — 최근 저장본 N 개라 저장이 잦은 Scenario 가 나머지를 밀어낸다.
 */
export function useSimulationScenarios(
  ruleSet: SimulationRuleSetRef,
  { tenantId, refreshIntervalMs = DEFAULT_REFRESH_MS, enabled = true }: UseSimulationScenariosOptions,
): SimulationScenarioList {
  const ruleSetId = ruleSet?.id;
  const list = usePolledList(
    "/simulation/saved-states/scenarios",
    { ruleSetId },
    `${tenantId}|${ruleSetId}`,
    tenantId,
    enabled,
    refreshIntervalMs,
    (body) => {
      const page = body as { scenarios?: ScenarioItem[]; truncated?: boolean } | undefined;
      return {
        scenarios: (page?.scenarios ?? []).map((item) => ({
          id: item.scenarioId,
          name: item.scenarioName,
          status: item.scenarioStatus,
          savedStateCount: item.savedStateCount,
          latestSavedAt: item.latestSavedAt,
        })),
        truncated: page?.truncated ?? false,
      };
    },
  );
  return {
    scenarios: list.data?.scenarios ?? EMPTY_SCENARIOS,
    truncated: list.data?.truncated ?? false,
    status: list.status,
    isLoading: list.status === "running",
    isForbidden: list.status === "forbidden",
    error: list.error,
    refetch: list.refetch,
  };
}

const EMPTY_SCENARIOS: SimulationScenarioSummary[] = [];

function toSummary(item: CatalogItem): SimulationSavedStateSummary {
  return {
    id: item.savedStateId,
    name: item.savedStateName,
    sequenceNo: item.sequenceNo,
    scenarioId: item.scenarioId,
    scenarioName: item.scenarioName,
    savedAt: item.createdAt,
    ruleSetVersion: item.ruleSetVersion,
  };
}
