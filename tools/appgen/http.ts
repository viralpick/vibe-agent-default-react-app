/**
 * app-api HTTP 클라이언트.
 *
 * ResponseBody 래퍼(`{meta:{code,message}, data, traceId}`)를 벗겨 data 만 돌려준다.
 *
 * 핵심: **traceId 를 절대 버리지 않는다.** app-api 는 500 을 `"서버 오류가 발생했습니다."`
 * 로 마스킹하므로 응답만으로는 원인을 알 수 없다. 실제 예외는 traceId 로 ClickHouse
 * `otel_traces` 의 `Events.Attributes['exception.message']` 에서 찾아야 한다
 * (`otel_logs_optimized` 의 Body 에는 `"Exception occurred: "` 만 남고 메시지가 비어 있다).
 * 그래서 에러 메시지에 traceId 와 조회 쿼리를 함께 실어 보낸다.
 */

import { DEV } from './bootstrap.ts'
import { readToken } from './token.ts'

export interface ApiErrorInfo {
  status: number
  code: string | null
  message: string | null
  traceId: string | null
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string | null
  readonly traceId: string | null

  constructor(info: ApiErrorInfo, requestLabel: string) {
    const parts = [`${requestLabel} → HTTP ${info.status}`]
    if (info.code) parts.push(`code=${info.code}`)
    if (info.message) parts.push(info.message)
    let text = parts.join(' | ')

    if (info.traceId) {
      text += `\n  traceId: ${info.traceId}`
      if (info.status >= 500) {
        // 500 은 메시지가 마스킹되므로 원인 조회 방법을 같이 준다.
        text +=
          '\n  실제 예외는 ClickHouse 에서 확인한다 (데이터소스 clickhouse-prod, dev 로그도 여기):' +
          "\n    SELECT SpanName, arrayStringConcat(arrayMap(m -> concat(m['exception.type'],' :: '," +
          "m['exception.message']), Events.Attributes), ' | ') AS exc" +
          `\n    FROM otel_traces WHERE TraceId = '${info.traceId}'` +
          '\n      AND Timestamp >= now() - INTERVAL 1 HOUR ORDER BY Timestamp'
      }
    }
    super(text)
    this.name = 'ApiError'
    this.status = info.status
    this.code = info.code
    this.traceId = info.traceId
  }
}

interface ResponseBodyShape {
  meta?: { code?: string; message?: string }
  data?: unknown
  traceId?: string
}

export interface RequestOptions {
  method?: 'GET' | 'POST'
  /** 쿼리 파라미터. undefined 값은 생략된다. */
  query?: Record<string, string | number | undefined>
  body?: unknown
  /** 테넌트(회사) ID. app-api 는 X-Tenant-ID 헤더로 테넌트를 선택한다. */
  tenantId: string
}

/**
 * app-api 를 호출하고 ResponseBody 의 data 를 반환한다.
 *
 * 환경은 dev 고정이다 (DEV.appApi). base URL 을 인자로 받지 않는 것은 의도다 — prod 로
 * 확장할 때 이 도구를 확장하지 않고 별도 진입점으로 분리한다.
 */
export async function apiRequest<T = unknown>(path: string, options: RequestOptions): Promise<T> {
  const { method = 'GET', query, body, tenantId } = options

  const url = new URL(path, DEV.appApi)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${readToken()}`,
    'X-Tenant-ID': tenantId,
    Accept: 'application/json',
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const label = `${method} ${url.pathname}${url.search}`
  const response = await fetch(url, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

  const text = await response.text()
  let parsed: ResponseBodyShape | null = null
  try {
    parsed = text ? (JSON.parse(text) as ResponseBodyShape) : null
  } catch {
    // ResponseBody 가 아닌 응답 (프록시 에러 페이지 등).
  }

  if (!response.ok) {
    throw new ApiError(
      {
        status: response.status,
        code: parsed?.meta?.code ?? null,
        message: parsed?.meta?.message ?? (parsed ? null : text.slice(0, 200)),
        traceId: parsed?.traceId ?? null,
      },
      label,
    )
  }

  if (parsed === null) throw new Error(`${label} → 응답이 JSON 이 아닙니다: ${text.slice(0, 200)}`)
  return parsed.data as T
}
