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

import { apiRequest } from './http.ts'

export interface OntologyRef {
  tenantId: string
}

// ── 카탈로그 탐색 ────────────────────────────────────────────────────────────

export function listCollections(ref: OntologyRef): Promise<unknown> {
  return apiRequest('/ontology-collections', { tenantId: ref.tenantId })
}

export function listCollectionEntities(ref: OntologyRef, collectionId: string): Promise<unknown> {
  return apiRequest(`/ontology-collections/${encodeURIComponent(collectionId)}/entities`, {
    tenantId: ref.tenantId,
  })
}

export function listObjects(ref: OntologyRef): Promise<unknown> {
  return apiRequest('/ontology-objects', { tenantId: ref.tenantId })
}

export function listLinks(ref: OntologyRef): Promise<unknown> {
  return apiRequest('/ontology-links', { tenantId: ref.tenantId })
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
    tenantId: ref.tenantId,
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
    tenantId: ref.tenantId,
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
    tenantId: ref.tenantId,
    body: input,
  })
}

/** 특정 객체에 속한 펑션 목록. `ontologyId` 는 필수 쿼리 파라미터다 (없으면 400). */
export function listFunctions(ref: OntologyRef, ontologyObjectId: string | number): Promise<unknown> {
  return apiRequest('/ontology-functions', {
    tenantId: ref.tenantId,
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
    tenantId: ref.tenantId,
    body: { parameters },
  })
}

// ── 액션 (읽기만) ────────────────────────────────────────────────────────────

/** 액션 목록. 생성된 앱의 ACTIONS 상수에 박을 UUID 를 여기서 얻는다. */
export function listActions(ref: OntologyRef): Promise<unknown> {
  return apiRequest('/ontology-actions', { tenantId: ref.tenantId })
}

/** 액션 실행 이력. 앱이 액션을 부르고 실패했을 때 원인을 추적한다. */
export function listActionRuns(ref: OntologyRef): Promise<unknown> {
  return apiRequest('/ontology-actions/runs', { tenantId: ref.tenantId })
}
