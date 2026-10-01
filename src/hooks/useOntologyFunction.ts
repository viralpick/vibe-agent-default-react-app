import { useCallback, useEffect, useRef, useState } from "react";
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
  isLoading: boolean;
  error: Error | null;
  /** 같은 파라미터로 다시 조회한다 */
  refetch: () => void;
}

export function useOntologyFunction<Row = Record<string, unknown>>(
  fn: OntologyFunctionRef,
  { tenantId, parameters, enabled = true }: UseOntologyFunctionOptions,
): UseOntologyFunctionResult<Row> {
  const apiClient = useApiClient();
  const [data, setData] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // 파라미터 객체는 렌더마다 새로 만들어지므로 내용으로 비교한다
  const parametersKey = JSON.stringify(parameters ?? {});
  // 늦게 도착한 이전 응답이 최신 결과를 덮어쓰지 않도록 요청 순번을 기억한다
  const requestSeq = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    const seq = ++requestSeq.current;
    setIsLoading(true);
    setError(null);
    apiClient
      .post(
        `/ontology-functions/${fn.id}/run`,
        { parameters: JSON.parse(parametersKey) },
        { headers: { "X-Tenant-Id": tenantId } },
      )
      .then((response) => {
        if (seq !== requestSeq.current) return;
        setData((response?.data?.data?.result as Row[] | undefined) ?? []);
      })
      .catch((cause: unknown) => {
        if (seq !== requestSeq.current) return;
        setData([]);
        setError(cause instanceof Error ? cause : new Error(String(cause)));
      })
      .finally(() => {
        if (seq === requestSeq.current) setIsLoading(false);
      });
  }, [apiClient, fn.id, tenantId, parametersKey, enabled, reloadKey]);

  const refetch = useCallback(() => setReloadKey((key) => key + 1), []);

  return { data, isLoading, error, refetch };
}
