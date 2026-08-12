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

import { DEV, type Environment } from './env.ts'
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
  /** 대상 환경. 생략하면 dev — 앱 디렉토리 밖에서 도는 명령용 기본값이다. */
  env?: Environment
}

/**
 * app-api 를 호출하고 ResponseBody 의 data 를 반환한다.
 *
 * 환경은 호출자가 넘긴다 (앱 메타에 박힌 값). 생략 시 dev 다 — 전역 기본값을 두지 않는
 * 원칙은 `env.ts` 참조.
 */
export async function apiRequest<T = unknown>(path: string, options: RequestOptions): Promise<T> {
  const { method = 'GET', query, body, tenantId, env = DEV } = options

  const url = new URL(path, env.appApi)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${readToken(env.name)}`,
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

  // app-api 는 대부분 `ResponseBody` 로 감싸지만 **전부는 아니다.** `/llms/environments` 는
  // `{models, tools}` 를 최상단에 바로 준다 (dev 실측). 봉투를 무조건 전제하면 그 엔드포인트가
  // undefined 를 돌려주고 호출부에서 `Cannot read properties of undefined` 로 터진다.
  //
  // truthiness 가 아니라 키 존재로 가른다. 삭제처럼 `data: null` 을 정상 값으로 주는 응답을
  // 봉투 없는 것으로 착각하면 안 된다.
  return ('data' in parsed ? parsed.data : parsed) as T
}

/**
 * agent-app 호출은 app-api 와 응답 규약이 다르다.
 *
 * | | app-api | agent-app (핸드오프 엔드포인트) |
 * |---|---|---|
 * | 성공 | `ResponseBody.data` 로 감싸짐 | 모델을 그대로 반환 |
 * | 실패 | `meta.code` / `meta.message` | FastAPI `{"detail": ...}` |
 * | traceId | 본문에 포함 | 없음 (헤더 `X-Trace-Id` 는 있을 수 있음) |
 *
 * `detail` 은 문자열일 때도 있고 객체일 때도 있다 (409 의 version_diverged 가 객체다).
 * 객체를 문자열로 뭉개면 클라이언트가 갈라짐을 구분할 수 없으므로 원형을 보존한다.
 */
export class AgentApiError extends Error {
  readonly status: number
  readonly detail: unknown

  constructor(status: number, detail: unknown, label: string, traceId: string | null) {
    const rendered = typeof detail === 'string' ? detail : JSON.stringify(detail)
    super(`${label} → HTTP ${status} | ${rendered}${traceId ? `\n  traceId: ${traceId}` : ''}`)
    this.name = 'AgentApiError'
    this.status = status
    this.detail = detail
  }

  /** push 가 받은 409 인지. 갈라짐이면 현재 서버 버전을 알려준다. */
  get divergedTo(): number | null {
    const d = this.detail
    if (this.status !== 409 || d === null || typeof d !== 'object') return null
    const current = (d as Record<string, unknown>).current_version
    return typeof current === 'number' ? current : null
  }
}

function authHeaders(env: Environment, tenantId: string): Record<string, string> {
  return {
    Authorization: `Bearer ${readToken(env.name)}`,
    // agent-app 은 미들웨어가 passport 를 안 줄 때 이 헤더로 테넌트를 정해 /authz/me 를 부른다.
    'X-Tenant-Id': tenantId,
  }
}

async function agentError(response: Response, label: string): Promise<AgentApiError> {
  const text = await response.text()
  let detail: unknown = text.slice(0, 400)
  try {
    const parsed = JSON.parse(text) as { detail?: unknown }
    if (parsed && typeof parsed === 'object' && 'detail' in parsed) detail = parsed.detail
  } catch {
    // JSON 이 아닌 응답 (프록시 에러 페이지 등) — 잘라낸 본문을 그대로 쓴다.
  }
  return new AgentApiError(response.status, detail, label, response.headers.get('X-Trace-Id'))
}

/** agent-app 에 multipart 로 파일과 필드를 올리고 JSON 을 받는다. */
export async function agentUpload<T = unknown>(
  path: string,
  options: {
    env: Environment
    tenantId: string
    file: { name: string; bytes: Uint8Array; contentType: string }
    fields: Record<string, string | undefined>
  },
): Promise<T> {
  const { env, tenantId, file, fields } = options
  const url = new URL(path, env.agentApi)

  const form = new FormData()
  form.append('file', new Blob([file.bytes], { type: file.contentType }), file.name)
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) form.append(key, value)
  }

  const label = `POST ${url.pathname}`
  // Content-Type 을 직접 넣지 않는다 — fetch 가 boundary 를 포함해 설정해야 한다.
  const response = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders(env, tenantId), Accept: 'application/json' },
    body: form,
  })
  if (!response.ok) throw await agentError(response, label)
  return (await response.json()) as T
}

/** agent-app 에서 바이트를 받는다. 응답 헤더도 함께 돌려준다 (스냅샷 버전이 헤더로 온다). */
export async function agentBytes(
  path: string,
  options: { env: Environment; tenantId: string; query?: Record<string, string | undefined> },
): Promise<{ bytes: Uint8Array; headers: Headers }> {
  const { env, tenantId, query } = options
  const url = new URL(path, env.agentApi)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value)
  }

  const label = `GET ${url.pathname}${url.search}`
  const response = await fetch(url, { headers: authHeaders(env, tenantId) })
  if (!response.ok) throw await agentError(response, label)
  return { bytes: new Uint8Array(await response.arrayBuffer()), headers: response.headers }
}
