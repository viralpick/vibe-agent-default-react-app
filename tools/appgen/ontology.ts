/**
 * 온톨로지 조회 + 펑션 생성.
 *
 * 툴 표면은 **제품 앱빌더의 선을 넘지 않는다.** 제품이 테넌트에 영속시키는 쓰기는
 * `create_ontology_function` 단 하나이며, 액션 생성·실행은 제품 앱빌더에도 없다
 * (`create_ontology_authoring_tools` 는 온톨로지 챗 전용이고, 액션 툴은
 * `list_ontology_actions` 만 통과시킨다). 액션은 사람이 UI 나 온톨로지 챗으로 사전 생성하고
 * 우리는 목록에서 UUID 만 읽어 코드에 박는다.
 *
 * 제외한 것과 근거:
 * - 액션 create / execute / dry_run — 제품에도 없다
 * - export (엑셀 반출) — authz 표준 어휘에서 `export` 는 데이터 반출로 위험 등급이 분리된
 *   action 이다. 앱 만들기에 불필요하다
 * - 객체·컬렉션·링크 생성 — 데이터 모델링은 사전 생성 전제
 * - 자연어 쿼리 계열 — 서버에서 LLM 을 돌리는 경로다. Claude Code 안에서 부르면 LLM 안의
 *   LLM 이 된다. 스키마를 보고 직접 SQL 을 쓰는 편이 정확하고 통제 가능하다
 */

import type { Environment } from './env.ts'
import { apiRequest } from './http.ts'

export interface OntologyRef {
  tenantId: string
  /** 대상 환경. 생략하면 dev — 앱 메타에 박힌 환경을 넘기는 것이 정상 경로다. */
  env?: Environment
}

// ── 카탈로그 탐색 ────────────────────────────────────────────────────────────

export function listCollections(ref: OntologyRef): Promise<unknown> {
  return apiRequest('/ontology-collections', { ...ref })
}

export function listCollectionEntities(ref: OntologyRef, collectionId: string): Promise<unknown> {
  return apiRequest(`/ontology-collections/${encodeURIComponent(collectionId)}/entities`, {
    ...ref,
  })
}

export function listObjects(ref: OntologyRef): Promise<unknown> {
  return apiRequest('/ontology-objects', { ...ref })
}

export function listLinks(ref: OntologyRef): Promise<unknown> {
  return apiRequest('/ontology-links', { ...ref })
}

// ── 스키마와 FQN ─────────────────────────────────────────────────────────────

export interface ObjectDetail {
  id: string
  name: string
  displayName?: string
  type?: string
  /** Lake 카탈로그 이름 (예: catalog_230378009121521664). */
  catalogName?: string
  /** 스키마에 해당하는 컬렉션 이름 (예: organization). */
  collection?: string
  /** `{컬럼명: 타입}` 맵. */
  structure?: Record<string, unknown>
  [key: string]: unknown
}

export function getObjectDetail(ref: OntologyRef, objectId: string): Promise<ObjectDetail> {
  return apiRequest<ObjectDetail>(`/ontology-objects/${encodeURIComponent(objectId)}/detail`, {
    ...ref,
  })
}

/**
 * 애드혹 SQL 에 쓸 3-part FQN 을 조립한다.
 *
 * 규칙은 제품의 `qualifyLakeTableRefs` 와 같다: `{catalog.name}.{collection.name}.{leaf}`.
 * **leaf 는 객체의 `name`** 이며 `collectionName` 이 아니다 (실측 확인).
 *
 * 애드혹 쿼리는 이 조립을 직접 해야 한다. bare 테이블명은 Spark 가
 * TABLE_OR_VIEW_NOT_FOUND 로 500, 2-part 는 400 이다. `qualifyLakeTableRefs` 는
 * **펑션 저장 경로에만** 적용되므로 `POST /ontology-functions` 에 넘기는 쿼리는 bare 로 써도 된다.
 */
export function buildFqn(detail: ObjectDetail): string {
  const { catalogName, collection, name } = detail
  if (!catalogName || !collection || !name) {
    throw new Error(
      `FQN 을 만들 수 없습니다 (catalogName/collection/name 필요): ` +
        `catalogName=${catalogName} collection=${collection} name=${name}`,
    )
  }
  return `${catalogName}.${collection}.${name}`
}

/**
 * 객체의 **스키마와 레코드를 함께** 본다.
 *
 * 응답은 `{name, displayName, properties, records}` 이고 `records` 는 페이지네이션
 * (`{content, totalElements, size, number, totalPages, hasNext}`) 이다 —
 * 레코드는 `records.content` 에 있다 (실측).
 *
 * 스키마만 보고 SQL 을 쓰면 값의 실제 형태(빈 문자열 vs null, 숫자가 문자열로 오는지)를 모른다.
 * 집계 컬럼은 숫자로 오지만 원본 컬럼은 대개 문자열이다 (실측: `judge_confidence` = `"0.95"`).
 *
 * `size` 는 Spring `Pageable` 파라미터다.
 */
export function listObjectRecords(
  ref: OntologyRef,
  objectId: string,
  size = 20,
): Promise<unknown> {
  return apiRequest(`/ontology-objects/${encodeURIComponent(objectId)}/records`, {
    ...ref,
    query: { size },
  })
}

// ── SELECT 쿼리 ──────────────────────────────────────────────────────────────

export interface SqlResult {
  columns: string[]
  rows: Record<string, unknown>[]
}

/**
 * 읽기 전용 SQL 을 실행한다.
 *
 * 실행 엔진은 **Spark** (Hive Thrift Server) 이므로 SparkSQL 문법으로 쓴다 — Swagger 의
 * "StarRocks에서 직접 SQL을 실행합니다" 설명은 낡았다 (실측: 스택에
 * `org.apache.spark.sql.hive.thriftserver.SparkExecuteStatementOperation`).
 *
 * 요청 필드명은 `sql` 이다 (`query` 아님). SELECT / WITH 만 허용되며 `SHOW SCHEMAS` 같은
 * 문장은 서버가 400 으로 거절한다.
 */
export function querySql(ref: OntologyRef, sql: string): Promise<SqlResult> {
  return apiRequest<SqlResult>('/ontology-objects/query/sql', {
    method: 'POST',
    ...ref,
    body: { sql },
  })
}

// ── 펑션 ────────────────────────────────────────────────────────────────────

export interface FunctionParameter {
  type: string
  description?: string
  required?: boolean
  [key: string]: unknown
}

export interface CreateFunctionInput {
  /**
   * 객체 id. **반드시 문자열로 다룬다.**
   *
   * AgentOS 의 id 는 snowflake 계열 64비트 정수라 `Number.MAX_SAFE_INTEGER`
   * (9007199254740991) 를 넘는다. JS `number` 로 담으면 하위 자릿수가 조용히 뭉개진다
   * (예: 230378751324585984 → 230378751324586000). 그러면 서버가 "온톨로지를 찾을 수
   * 없습니다" 로 응답하는데, id 를 눈으로 대조하지 않으면 권한 문제로 오해하기 쉽다
   * (Tier 2 인스턴스 접근 실패로 403 이 난다).
   *
   * Kotlin 쪽 DTO 는 `Long` 이고 Jackson 이 JSON 문자열을 Long 으로 강제 변환하므로
   * 문자열로 보내면 정밀도 손실 없이 전달된다.
   */
  ontologyObjectId: string
  name: string
  displayName: string
  description: string
  /** SELECT / WITH 로 시작해야 한다. FROM 은 서버가 3-part FQN 으로 정규화한다. */
  query: string
  parameters: Record<string, FunctionParameter>
  /** JOIN 이 참조하는 추가 객체 id. FROM 화이트리스트에 포함된다. 위와 같은 이유로 문자열. */
  joinObjectIds?: string[]
}

/**
 * 재사용 펑션을 만든다. **우리 도구의 유일한 영속 쓰기다.**
 *
 * 서버가 저장 시점과 실행 시점 양쪽에서 `validateLakeSqlQuery` 로 재검증한다:
 * SELECT/WITH 접두, 금지 키워드(DROP/INSERT/UPDATE/DELETE 등), FROM 화이트리스트
 * (선언한 객체 + joinObjectIds 만), quoted identifier 차단. 그래서 펑션은 쓰기 벡터가 될 수
 * 없고 임의 테이블 조회도 못 한다.
 *
 * 부수 이득으로 `qualifyLakeTableRefs` 가 FROM 을 3-part FQN 으로 정규화한다. agent-app
 * 직저장 경로는 이 정규화를 우회해 bare 테이블명이 저장되고 Spark 런타임에 지연 폭발하는
 * 버그가 있는데, 이 API 를 타면 그 문제를 피한다.
 *
 * 주의: Tier 1(`ontology.function` create) 외에 대상 객체의
 * `ontology.catalog.collection.object#read` 인스턴스 접근도 필요하다. 없는 객체를 지정하면
 * 403 이 나는데 메시지가 create 가 아니라 그 리소스를 지목한다.
 */
export function createFunction(ref: OntologyRef, input: CreateFunctionInput): Promise<unknown> {
  return apiRequest('/ontology-functions', {
    method: 'POST',
    ...ref,
    body: input,
  })
}

/** 특정 객체에 속한 펑션 목록. `ontologyId` 는 필수 쿼리 파라미터다 (없으면 400). */
export function listFunctions(ref: OntologyRef, ontologyObjectId: string | number): Promise<unknown> {
  return apiRequest('/ontology-functions', {
    ...ref,
    query: { ontologyId: String(ontologyObjectId) },
  })
}

/** 저장된 펑션을 파라미터와 함께 실행한다. 생성된 앱이 런타임에 부르는 것과 같은 경로다. */
export function runFunction(
  ref: OntologyRef,
  functionId: string,
  parameters: Record<string, unknown> = {},
): Promise<unknown> {
  return apiRequest(`/ontology-functions/${encodeURIComponent(functionId)}/run`, {
    method: 'POST',
    ...ref,
    body: { parameters },
  })
}

// ── 앱빌더 챗 ────────────────────────────────────────────────────────────────

export interface ModelItem {
  code: string
  displayName: string
  provider: string
  visible: boolean
  /** 앱빌더 모델 셀렉터 그룹. `NONE` 이면 앱빌더에 노출되지 않는다. */
  appBuilderGroup: 'NONE' | 'SPEED' | 'QUALITY'
  isDefault: boolean
}

/**
 * 앱빌더 챗에 쓸 수 있는 모델 목록.
 *
 * `appBuilderGroup !== 'NONE'` 이 앱빌더 셀렉터에 노출되는 조건이다 (`LlmDto.kt`). 이 필터를
 * 거치지 않고 아무 코드나 넣으면 **제품 에이전트가 첫 단계에서 죽는다** —
 * `_initialize_model` 이 `llm_model` 조회 실패 시 ValueError 를 던지고, FE 는 "배포에
 * 실패했습니다" 라는 제네릭 문구만 보여줘서 원인을 알기 어렵다 (실측).
 */
export async function listAppBuilderModels(ref: OntologyRef): Promise<ModelItem[]> {
  const response = await apiRequest<{ models: ModelItem[] }>('/llms/environments', { ...ref })
  return (response.models ?? []).filter((m) => m.appBuilderGroup !== 'NONE' && m.visible)
}

export interface CreateChatInput {
  name: string
  /** `listAppBuilderModels` 가 준 `code`. */
  model: string
  /** 로컬 프리셋과 같아야 한다 — 어긋나면 제품 첫 수정에서 디자인이 덮어써진다. */
  designMode: string
}

/**
 * 빈 앱빌더 챗을 만든다.
 *
 * 제품 UI 로 만들면 프롬프트를 보내 **에이전트 생성 한 턴이 함께 돌아간다** (LLM 비용 +
 * 샌드박스 기동 + 곧 덮어쓸 v1 스냅샷). 우리는 빈 챗만 필요하므로 직접 만든다.
 *
 * `chat.member_id` 는 이 JWT 의 주체가 된다. 고객에게 넘길 앱이면 **고객이 만들어야** 한다
 * (제품이 챗 소유자만 열 수 있게 막는다).
 */
export function createChat(ref: OntologyRef, input: CreateChatInput): Promise<{ id: string }> {
  return apiRequest<{ id: string }>('/chats', {
    method: 'POST',
    ...ref,
    body: {
      name: input.name,
      model: input.model,
      chatMode: null,
      tools: null,
      ontologyObjects: null,
      agentType: 'dashboard',
      responseLength: null,
      work: null,
      design: { mode: input.designMode },
    },
  })
}

// ── 액션 (읽기만) ────────────────────────────────────────────────────────────

/** 액션 목록. 생성된 앱의 ACTIONS 상수에 박을 UUID 를 여기서 얻는다. */
export function listActions(ref: OntologyRef): Promise<unknown> {
  return apiRequest('/ontology-actions', { ...ref })
}

/** 액션 실행 이력. 앱이 액션을 부르고 실패했을 때 원인을 추적한다. */
export function listActionRuns(ref: OntologyRef): Promise<unknown> {
  return apiRequest('/ontology-actions/runs', { ...ref })
}
