import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useApiClient } from "@/api/api.client";

// OntologyFunction 조회 hook (AOS-4888).
//
// 생성된 앱은 데이터를 **이 hook 으로만** 가져온다. 함수 하나 = 호출 하나 = 이름 붙은 결과 하나로
// 모양을 고정해 두면, 빌드 플러그인(vite-plugins/aos-locator)이 AST 만으로
// "어느 컴포넌트가 어느 함수의 데이터를 그리는지" 를 결정론적으로 추적할 수 있다.
// LLM 이 data-aos-functions 에 UUID 를 베껴 쓰던 것을 그 추적이 대신한다.
//
// 추적 규칙과 맞물리는 계약 — 바꾸면 플러그인도 함께 바꿔야 한다:
//  - 첫 인자는 반드시 `FUNCTIONS.<key>` (플러그인·ontology_gate 가 그 key 로 UUID 를 찾는다)
//  - 결과의 `data` 만 함수 데이터로 본다. `isLoading` / `error` / `refetch` 는 추적 대상이 아니다
//    (로딩 플래그를 여러 컴포넌트에 넘겨도 그 컴포넌트들이 모든 함수를 쓰는 것으로 오염되지 않게)
//
// 같은 함수를 여러 컴포넌트가 부르면 요청은 한 번만 나간다 (stale-while-revalidate).
// 결과는 (회사, 함수, 파라미터) 별로 모듈 캐시에 두고, 같은 key 의 hook 들이 그 결과를 함께 본다.
//  - 캐시에 결과가 있으면 바로 보여 주고, 마지막 조회가 DEDUPE_MS 보다 오래됐으면 뒤에서 다시 조회한다
//  - 진행 중인 요청이 있으면 새로 보내지 않고 그 요청을 기다린다
//  - `refetch` 는 이 규칙과 상관없이 바로 다시 조회하고, 결과는 같은 key 의 모든 hook 에 반영된다

export interface OntologyFunctionRef {
  id: string;
  description?: string;
}

export interface UseOntologyFunctionOptions {
  /** `[Tenant Context]` 의 tenant_id. 모든 호출에 X-Tenant-Id 헤더로 실린다 */
  tenantId: string;
  /** 함수 파라미터. 값이 바뀌면 자동으로 다시 조회한다 */
  parameters?: Record<string, unknown>;
  /** false 면 조회하지 않는다 (예: 선행 선택값이 아직 없을 때) */
  enabled?: boolean;
}

export interface UseOntologyFunctionResult<Row> {
  data: Row[];
  /** 아직 받은 결과가 없고 요청 중일 때만 true. 캐시를 보여 주며 다시 조회할 때는 false */
  isLoading: boolean;
  error: Error | null;
  /** 같은 파라미터로 바로 다시 조회한다 */
  refetch: () => void;
}

type ApiClient = ReturnType<typeof useApiClient>;

interface Snapshot {
  rows: unknown[] | null;
  error: Error | null;
  inFlight: boolean;
}

interface Entry {
  snapshot: Snapshot;
  fetchedAt: number;
  seq: number;
  listeners: Set<() => void>;
}

/** 이 시간 안에 받은 결과는 새로 마운트된 hook 이 다시 조회하지 않는다 */
const DEDUPE_MS = 2000;
const IDLE: Snapshot = { rows: null, error: null, inFlight: false };
const cache = new Map<string, Entry>();

function entryOf(key: string): Entry {
  let entry = cache.get(key);
  if (!entry) {
    entry = { snapshot: IDLE, fetchedAt: 0, seq: 0, listeners: new Set() };
    cache.set(key, entry);
  }
  return entry;
}

function publish(entry: Entry, next: Partial<Snapshot>) {
  // useSyncExternalStore 는 참조로 바뀜을 판단하므로 매번 새 객체로 바꾼다
  entry.snapshot = { ...entry.snapshot, ...next };
  entry.listeners.forEach((listener) => listener());
}

function revalidate(
  key: string,
  apiClient: ApiClient,
  fnId: string,
  tenantId: string,
  parametersKey: string,
  force: boolean,
) {
  const entry = entryOf(key);
  if (!force) {
    if (entry.snapshot.inFlight) return;
    if (entry.snapshot.rows !== null && Date.now() - entry.fetchedAt < DEDUPE_MS) return;
  }
  // 늦게 도착한 이전 응답이 최신 결과를 덮어쓰지 않도록 요청 순번을 기억한다
  const seq = ++entry.seq;
  publish(entry, { inFlight: true });
  apiClient
    .post(
      `/ontology-functions/${fnId}/run`,
      { parameters: JSON.parse(parametersKey) },
      { headers: { "X-Tenant-Id": tenantId } },
    )
    .then((response) => {
      if (seq !== entry.seq) return;
      // 행이 아닌 값(null 등)은 여기서 걸러 둔다 — 앱 코드가 방어용 filter 를 붙이지 않아도 되게.
      // (그런 filter 가 붙으면 홈 위젯이 "가공된 데이터" 로 보고 앱을 통째로 띄워야 한다)
      const rows = (response?.data?.data?.result as unknown[] | undefined) ?? [];
      entry.fetchedAt = Date.now();
      publish(entry, {
        rows: rows.filter((row) => row !== null && typeof row === "object"),
        error: null,
        inFlight: false,
      });
    })
    .catch((cause: unknown) => {
      if (seq !== entry.seq) return;
      // 다시 조회하다 실패해도 이전 결과는 남겨 둔다 — 화면이 비지 않게 하고 error 로 알린다
      publish(entry, {
        error: cause instanceof Error ? cause : new Error(String(cause)),
        inFlight: false,
      });
    });
}

/** 테스트에서 hook 사이에 캐시를 비운다 */
export function clearOntologyFunctionCache() {
  cache.clear();
}

export function useOntologyFunction<Row = Record<string, unknown>>(
  fn: OntologyFunctionRef,
  { tenantId, parameters, enabled = true }: UseOntologyFunctionOptions,
): UseOntologyFunctionResult<Row> {
  const apiClient = useApiClient();
  // 파라미터 객체는 렌더마다 새로 만들어지므로 내용으로 비교한다
  const parametersKey = JSON.stringify(parameters ?? {});
  const key = JSON.stringify([tenantId, fn.id, parametersKey]);

  const subscribe = useCallback(
    (listener: () => void) => {
      const entry = entryOf(key);
      entry.listeners.add(listener);
      return () => {
        entry.listeners.delete(listener);
      };
    },
    [key],
  );
  const getSnapshot = useCallback(() => cache.get(key)?.snapshot ?? IDLE, [key]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!enabled) return;
    revalidate(key, apiClient, fn.id, tenantId, parametersKey, false);
  }, [key, apiClient, fn.id, tenantId, parametersKey, enabled]);

  const refetch = useCallback(() => {
    if (!enabled) return;
    revalidate(key, apiClient, fn.id, tenantId, parametersKey, true);
  }, [key, apiClient, fn.id, tenantId, parametersKey, enabled]);

  if (!enabled) return { data: [], isLoading: false, error: null, refetch };
  return {
    data: (snapshot.rows ?? []) as Row[],
    isLoading: snapshot.rows === null && snapshot.error === null,
    error: snapshot.error,
    refetch,
  };
}
