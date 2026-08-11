# App Builder Agent - Code Generation Guide

This document defines API patterns, data handling, and code structure rules for generating React + TypeScript applications. For UI components and styling, see `.cos/DESIGN.md`.

---

## Table of Contents

0. [코드 탐색 절차](#0-코드-탐색-절차)
1. [Layout Rules](#1-layout-rules)
2. [OntologyFunction 데이터 조회 패턴](#2-ontologyfunction-데이터-조회-패턴)
3. [OntologyAction 실행 패턴 (CUD / 외부 API)](#3-ontologyaction-실행-패턴-cud--외부-api)
4. [Code Generation Patterns](#4-code-generation-patterns)
5. [Forbidden Patterns](#5-forbidden-patterns)
6. [Component Identification (`data-aos-id`)](#6-component-identification-data-aos-id)

---

## 0. 코드 탐색 절차

수정할 코드를 찾을 때는 아래 순서를 지킨다.

1. `list_files` 로 구조를 파악한다.
2. `search_files` 로 수정 대상의 정확한 위치(파일 경로 + 줄 번호)를 특정한다.
3. `read_file(path, offset, limit)` 으로 **그 구간만** 읽는다. 2번에서 얻은 줄 번호를 `offset` 에 그대로 넣는다.
4. `edit_file` 로 부분 수정한다. 파일 전체를 `write_file` 로 덮어쓰는 것은 새 파일 생성이 아니면 지양한다.

**큰 파일을 `read_file` 로 통째로 읽지 마라.** 참조한 코드량이 한계를 넘으면 작업 전체가 실패하고, 그때까지의 변경도 사용자에게 전달되지 않는다. `read_file` 은 기본 400줄(최대 2000줄)만 반환하며, 더 필요하면 `offset` 을 옮겨 이어 읽는다.

단, `.cos/DESIGN.md` 는 예외로 전문이 반환된다 — Phase 0 에서 한 번 읽으면 컴포넌트 카탈로그 전체를 확보한 것이므로 `offset` 으로 다시 읽을 필요가 없다.

같은 파일을 이미 읽었다면 다시 읽지 않는다 — 앞서 읽은 내용은 그대로 남아 있다.

---

## 1. Layout Rules

### 1.1 Root Structure

Every generated `src/App.tsx` must follow this layout skeleton. The skeleton below is
**design-system neutral** — it only fixes the page regions and their order. The actual UI
components (cards, charts, tables, date pickers), their imports, and styling tokens are
defined by the active design system in `.cos/DESIGN.md`. **Read DESIGN.md and use exactly
the components, imports, and tokens it specifies** — do not assume any specific library here.

```tsx
return (
  // Root container: scrollable, fills available space, no fixed viewport sizing.
  // Background/spacing classes come from DESIGN.md tokens — see DESIGN.md.
  <div className="overflow-auto flex-1 min-w-0 h-full">
    <div className="flex flex-col gap-6">
      {/* Page Header — title + description (+ optional date filter from DESIGN.md) */}
      <header> ... </header>

      {/* KPI region — a grid of metric cards (component & tokens per DESIGN.md) */}
      <section className="grid"> ... </section>

      {/* Charts region — a grid of chart cards (chart components per DESIGN.md) */}
      <section className="grid"> ... </section>

      {/* Table region — a data table (component per DESIGN.md) */}
      <section> ... </section>
    </div>
  </div>
);
```

- Use the design system's components, chart components, and date-picker/filter pattern
  exactly as `.cos/DESIGN.md` specifies.
- Use the design system's spacing/color/typography tokens (e.g. background, text size,
  semantic colors) per DESIGN.md — do **not** hardcode raw Tailwind colors or raw `text-sm`.

### 1.2 Component Ordering

1. **Root container** — `<div>` with overflow, fills available space (no fixed viewport)
2. **Page header** — title + description + optional date filter
3. **KPI region** — grid of metric cards
4. **Charts region** — grid of chart cards
5. **Table region** — a data table

(Which concrete components fill each region — and their imports/tokens — is defined by
`.cos/DESIGN.md`.)

### 1.3 Embedded App Rules

The app runs inside an iframe in a host UI. Therefore:

- **NO** `min-h-screen` or `h-screen` on the outermost container
- **NO** "Not running in iframe" error banners
- Never assume control of `<body>` or full viewport

---

## 2. OntologyFunction 데이터 조회 패턴

앱에서 데이터를 조회할 때는 **저장된 OntologyFunction**을 사용한다.

### 2.0 함수 확보 워크플로우 (재사용 우선)

대시보드에 필요한 데이터 조회 함수는 아래 순서를 그대로 따른다.
**같은 의도의 함수를 새로 만드는 것은 반드시 피한다** — 같은 ontology에 거의 동일한 함수가 누적되면 유지보수가 깨진다.

#### Step 1. 대상 ontology 선정

`list_ontologies`로 사용할 데이터 소스를 정하고 그 `ontology_id`를 기억한다.

#### Step 2. 스키마 조회

`get_ontology_schema(ontology_id)`로 해당 ontology의 필드 정의와 데이터 구조를 확인한다. 어떤 필드가 있는지 알아야 재사용/신규 판단도, 새 쿼리 작성도 정확해진다.

#### Step 3. 기존 함수 조회

`list_ontology_functions(ontology_id)`를 호출하여 해당 ontology에 이미 등록된 함수 목록을 확인한다.

반환되는 각 함수에는 `id`, `display_name`, `description`, `parameters`가 포함되므로, Step 2의 스키마와 함께 보면 의도 일치 여부와 파라미터 호환성을 정확히 판단할 수 있다.

#### Step 4. 재사용 가능 여부 판단

| 조건 | 결정 |
|------|------|
| display_name/description이 의도와 일치 **AND** parameters 시그니처 호환 | **재사용** — 그 `id`를 `FUNCTIONS` 상수에 그대로 사용 |
| 의도는 같으나 parameters가 호환 안 됨 (예: pagination 없는 vs 있는) | **신규 생성** |
| 비슷하지만 출력 형태/집계 기준이 다름 | **신규 생성** |
| 명백히 다른 의도 | **신규 생성** |

#### Step 5. 신규 생성이 필요한 경우만

1. ontology type 에 맞게 쿼리 작성 (아래 "쿼리 작성 규칙" 참조)
2. `query_ontology` 또는 `request_ontology_data_one_shot`로 쿼리 검증
3. `create_ontology_function`으로 등록 — `name`은 의도가 드러나는 구체적인 이름 사용 (예: `get_review_summary_by_period`)
4. `call_ontology_function(function_id, parameters)`로 dry-run 검증 — App.tsx 에 박기 전 의도한 데이터가 나오는지 한 번 확인

#### Step 6. 재사용 시에도 dry-run 권장

기존 함수를 그대로 쓰기로 했더라도, parameters 시그니처에 자신이 없거나 사용자의 의도와 미묘하게 다를 가능성이 있으면 `call_ontology_function`으로 한 번 호출해서 반환 형태를 확인한 뒤 App.tsx 에 적용한다.

#### 쿼리 작성 규칙 — ontology type 별로 다름

`get_ontology_schema` 응답의 ontology `type` 필드를 먼저 확인한다.

| type | 쿼리 언어 | placeholder | FROM 절 |
|------|----------|-------------|---------|
| `Json` | MongoDB aggregation pipeline (JSON 배열) | `{{paramName}}` (문자열은 따옴표 안에, 숫자/Boolean 은 따옴표 없이 `"{{n}}"` 형태 가능) | (해당 없음 — collection 으로 자동 라우팅) |
| `Lake` | SparkSQL (SELECT/WITH 만 허용) | `{{paramName}}` — JDBC bind 로 안전하게 치환됨 | 자신의 ontology 테이블 (여러 ontology 조인 집계 시 `join_object_ids` 에 명시한 같은 회사·Lake 온톨로지 테이블도 허용 — 아래 "여러 ontology 조인 집계" 참조) |

##### Lake (SparkSQL) 작성 시 추가 제약

- `SELECT` 또는 `WITH` 로 시작해야 함 — DDL/DML 키워드(`DROP`/`INSERT`/`UPDATE`/`DELETE`/`MERGE`/`REPLACE`/`ALTER`/`CREATE`/`TRUNCATE`/`SET`/`CALL`/`ANALYZE` 등) 사용 시 저장 자체가 거부됨
- `?` 를 쿼리에 직접 쓰지 말 것 — 파라미터는 반드시 `{{paramName}}` 로만 표현 (백엔드가 자동으로 `?` 로 변환하고 bind)
- **placeholder 를 quote 로 감싸지 말 것** — `WHERE col = {{name}}` (O), `WHERE col = '{{name}}'` (X). String 타입은 자동으로 single-quote literal 로 변환되므로 추가 quote 를 두르면 broken SQL 이 됨
- backtick(`` ` ``) / double-quote(`"`) 식별자 사용 금지 — `SELECT * FROM \`other.table\`` 같은 quoted identifier 자체가 reject 됨
- 콤마-구분 join (`FROM a, b`) 금지 — 반드시 `JOIN` 키워드 사용
- `FROM`/`JOIN` 절의 테이블 참조는 ontology 의 정확한 식별자만 허용:
  - 1-part: `table` (= `get_ontology_schema` 응답의 `name`, 예: `company_object`)
  - 2-part: `schema.table` (예: `organization.company_object`)
  - 3-part: `catalog.schema.table` (예: `catalog_55960957...organization.company_object`)
  - 각 part 가 ontology 의 실제 catalog/schema 와 정확히 일치해야 통과 (다른 catalog 의 동명 테이블 우회 차단)
- **여러 ontology 조인 집계** (예: VoC↔인구통계↔구독계약라인을 공통 키로 조인해 집계): `create_ontology_function` 의 `join_object_ids` 에 대표 외 온톨로지 ID 를 넣어 하나의 조인 집계 함수로 만든다.
  - 대표(`ontology_id`)와 조인 대상(`join_object_ids`)은 **모두 Lake(SQL) 타입이고 같은 회사 소유**여야 한다. 다른 엔진(Json/ClickHouse) 혼재나 다른 회사(=다른 catalog) 조인은 거부된다.
  - 이때 SQL 의 **모든 테이블은 3-part FQN(`catalog.schema.table`)으로 작성**한다 — 각 ontology 의 `fully_qualified_table_name`(= `get_ontology_schema`/`list_ontologies` 응답) 을 그대로 사용. bare 이름/1-part 는 실행 시 해석 실패.
  - 예: `SELECT p.region, COUNT(*) FROM cat.voc.voc_history v JOIN cat.demographics.profile p ON p.customer_number = v.customer_number GROUP BY p.region` + `join_object_ids=["<profile ontology id>"]`
  - Lake 로 표현하기 어려운 임시 탐색 조인(엔진 혼재 포함)은 여전히 `query_cross_ontology_natural_language` 도구로 조회할 수 있으나, 차트 backing 함수로 저장하려면 위 join_object_ids 경로를 쓴다.
- **WHERE 절의 placeholder 에 함수 적용 금지** — `WHERE date >= SUBSTRING({{date_from}}, 1, 10)` ❌ . Iceberg 의 partition pruning / file skipping 이 동작 안 해 **풀스캔으로 전환**되어 수십 배 느려짐 (30초+ → timeout). 데이터 정제는 클라이언트(App.tsx)에서 처리하고 SQL 은 plain literal 비교만:
  - ❌ Bad: `WHERE date >= SUBSTRING({{date_from}}, 1, 10)` + `date_from: range.start.toISOString()`
  - ✅ Good: `WHERE date >= {{date_from}}` + `date_from: range.start.toISOString().slice(0, 10)`
  - 같은 원칙으로 `UPPER({{name}})`, `TO_DATE({{ts}}, '...')` 등 모든 함수 wrapping 금지
  - 컬럼 측 함수(`SUBSTRING(date, 1, 7)` 같은 GROUP BY 표현)는 OK — placeholder 가 아니므로 무관

##### Lake 쿼리 예시

```sql
SELECT id, name, kor_name
FROM company_object
WHERE parent_company_id = {{parent_id}}
  AND created_at >= {{from_ts}}
ORDER BY created_at DESC
LIMIT {{limit}} OFFSET {{offset}}
```

parameters 정의:

```json
{
  "parent_id":  {"type": "Integer",  "description": "상위 company id"},
  "from_ts":    {"type": "String",   "description": "조회 시작 ISO datetime"},
  "limit":      {"type": "Integer",  "default": 100},
  "offset":     {"type": "Integer",  "default": 0}
}
```

#### 흐름 예시

> 사용자: "지난 30일 리뷰 감정 분포 대시보드 만들어줘"
>
> 1. `list_ontologies()` → 리뷰 ontology의 id 확보
> 2. `get_ontology_schema(ontology_id)` → 필드 구조 확인 (`review_score`, `sentiment`, `created_day` 등) + ontology type 확인
> 3. `list_ontology_functions(ontology_id)` → 기존 함수 N개 확인
> 4. `get_review_summary`(기간별 리뷰 요약, parameters: `date_from`/`date_to`) 발견 → 의도 일치, parameters 호환 → **재사용**
> 5. `call_ontology_function("019daed3-...", { date_from: "...", date_to: "..." })` → 반환 형태/필드 확인
> 6. `FUNCTIONS.review_summary = { id: "019daed3-..." }` 로 App.tsx에 박음

#### Forbidden

- ❌ Step 3을 건너뛰고 바로 `create_ontology_function` 호출
- ❌ "이름이 약간 달라야 할 것 같으니까" 새로 만들기 — 의도가 같으면 재사용
- ❌ 같은 세션에서 자기가 방금 만든 함수와 비슷한 걸 또 만들기
- ❌ Lake 타입 함수 쿼리에 `?` 직접 사용, 또는 자신의 ontology `name`/`collection_name` 이 아닌 다른 테이블 참조
- ❌ `call_ontology_function` 을 사용자 대시보드의 실제 데이터 로드 경로로 쓰는 것 — 그건 App.tsx 의 `/ontology-functions/{id}/run` 호출이고, `call_ontology_function` 은 빌드 시점 검증 용도임

### 2.1 기본 호출 패턴

모든 `apiClient` 호출에는 **`X-Tenant-Id` 헤더가 필수**다 (app-api-v2 정식 지원). 값은 빌드 시점에 주입되는 `[Tenant Context]` 의 tenant_id 를 `TENANT_ID` 상수로 박아서 사용한다 (자세한 패턴은 §2.4a).

```tsx
const response = await apiClient.post(
  `/ontology-functions/${functionId}/run`,
  {
    parameters: {
      date_from: range.start.toISOString(),
      date_to: range.end.toISOString(),
    }
  },
  { headers: { "X-Tenant-Id": TENANT_ID } }
);

// 결과 접근
const result = response?.data?.data?.result || [];
```

### 2.2 병렬 호출 패턴 (권장)

여러 쿼리를 동시에 실행할 때는 Promise.all 사용:

```tsx
const dateParams = {
  date_from: range.start.toISOString(),
  date_to: range.end.toISOString(),
};
const tenantHeader = { headers: { "X-Tenant-Id": TENANT_ID } };

const [aggResponse, rowResponse] = await Promise.all([
  apiClient.post(
    `/ontology-functions/${FUNCTIONS.daily_stats.id}/run`,
    { parameters: dateParams },
    tenantHeader
  ),
  apiClient.post(
    `/ontology-functions/${FUNCTIONS.review_list.id}/run`,
    {
      parameters: {
        ...dateParams,
        offset: 0,    // supports_pagination=True인 함수는 반드시 전달
        limit: 20,
      }
    },
    tenantHeader
  ),
]);
```

**IMPORTANT**: `create_ontology_function`에서 `supports_pagination=True`로 생성한 함수는 `offset`과 `limit` 파라미터가 자동 추가된다. 이 함수를 `/run`으로 호출할 때 **반드시 `offset`과 `limit` 값을 parameters에 포함**해야 한다. 누락 시 서버 에러가 발생한다.

**더 중요**: `supports_pagination=True` 로 함수 만들 때 **query 본문에 `LIMIT` / `OFFSET` 을 직접 작성하지 말 것**. 자동으로 끝에 `LIMIT {{limit}} OFFSET {{offset}}` (또는 MongoDB 의 `$skip` / `$limit` stage)이 추가된다. 사용자가 직접 LIMIT 을 작성하면:
- (1) 자동 추가 가드가 감지하여 추가하지 않음 — 사용자 LIMIT 이 우선 적용
- (2) 그러나 가드는 안전망일 뿐이고 의도가 헷갈리므로, `supports_pagination=True` 면 query 에서 LIMIT/OFFSET 를 빼는 게 정공
- ✅ 권장: query 작성 시 LIMIT 빼고 `supports_pagination=True` 만 지정 → 자동 추가에 위임
- ❌ 피할 것: `... LIMIT {{limit}} OFFSET {{offset}}` 을 query 에 직접 쓰면서 `supports_pagination=True` 도 같이 지정 (중복 위험)

### 2.3 응답 구조

```typescript
// response.data.data:
{
  "query": "...",           // 원본 템플릿 쿼리
  "executedQuery": "...",   // 파라미터 치환된 쿼리
  "result": [               // 실제 데이터 배열 (MongoDB Document 형태)
    { field1: value1, field2: value2, ... },
    ...
  ]
}

// 접근 방법
const rows = response?.data?.data?.result || [];
```

### 2.4 FUNCTIONS 상수 패턴

create_ontology_function으로 저장된 function ID를 상수로 관리:

```tsx
const FUNCTIONS = {
  daily_stats: {
    id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",  // create_ontology_function 응답의 id
    description: "일별 집계 데이터",
  },
  review_list: {
    id: "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
    description: "최근 리뷰 목록",
  },
};
```

### 2.4a TENANT_ID 상수 (필수)

app-api-v2 의 정식 spec 상 모든 API 호출 (`/ontology-functions/*`, `/ontology-actions/*`) 은 `X-Tenant-Id` 헤더를 요구한다. 값은 빌드 시점에 사용자 메시지의 `[Tenant Context]` 블록으로 전달되는 tenant_id (= 사용자 회사 id) 를 그대로 박는다.

```tsx
// App.tsx 최상단, FUNCTIONS/ACTIONS 상수와 같은 자리에 선언
// 값은 사용자 메시지의 [Tenant Context] 에 명시된 정수 그대로 (string 으로 캐스팅)
const TENANT_ID = "123";  // 예: 사용자 회사 id 가 123 인 경우
```

- **반드시 string 으로** 박을 것 (HTTP header 는 string). 정수 그대로 쓰면 axios 가 toString 하지만 명시적으로 quote 해서 의도를 분명히 한다.
- 모든 `apiClient.post(url, body, { headers: { "X-Tenant-Id": TENANT_ID } })` 호출에 동일 상수를 사용 — 인라인으로 매번 쓰지 말 것.
- 반복되는 헤더 객체는 한 번만 만들어서 재사용 가능: `const tenantHeader = { headers: { "X-Tenant-Id": TENANT_ID } };`

### 2.5 날짜 파라미터 처리

파라미터 이름은 `create_ontology_function` 호출 시 지정한 이름을 사용한다.

#### 날짜 필터(date range)와 연동하는 경우

날짜 범위를 `range` state 로 들고, `fetchData` 의 의존성에 넣어 **range 가 바뀌면 자동 재조회**되게 한다.
(어떤 날짜 필터 컴포넌트를 쓰는지는 `.cos/DESIGN.md` 가 정의한다 — DESIGN.md 의 date-picker/filter 패턴을 그대로 사용.)

```tsx
const [range, setRange] = useState<{ start: Date; end: Date }>(() => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  return { start: thirtyDaysAgo, end: now };
});

// range가 바뀔 때마다 fetchData가 자동 실행된다 — 별도 새로고침 버튼 불필요
const fetchData = useCallback(async () => {
  const params = {
    date_from: range.start.toISOString(),
    date_to: range.end.toISOString(),
  };
  // ... apiClient.post(...)
}, [apiClient, range]);

useEffect(() => { fetchData(); }, [fetchData]);

// 날짜 필터 컴포넌트(DESIGN.md 지정)는 선택된 범위로 setRange 를 호출하기만 하면 된다:
//   onChange → setRange({ start, end })  → useEffect 가 fetchData 재실행
```

`range`가 `fetchData`의 의존성에 포함되므로, 날짜 필터에서 범위를 변경하면 `useEffect`가 자동으로 `fetchData`를 재실행한다. **수동 새로고침 버튼을 추가하지 말 것.**

**NEVER** hardcode specific dates like `"2025-12-01"` in parameters.

### 2.6 FORBIDDEN PATTERNS

❌ 절대 사용 금지:
- GraphQL 쿼리 (`/sources/graphql` 엔드포인트)
- `injectDateFilters()` 함수 (OntologyFunction에서는 파라미터로 날짜를 전달)
- `aggregation { ... }` 또는 `source { ... }` GraphQL 구문

### 2.7 지식사전 활용

`vector_search_knowledge` tool이 사용 가능한 경우, 회사의 지식사전을 검색할 수 있다.
지식사전에는 비즈니스 규칙, 지표 정의, 도메인 용어 등이 포함될 수 있다.

**활용 시점:**
- Phase 1에서 데이터 스키마를 확인한 후, 해당 도메인의 배경 지식이 필요할 때
- KPI 카드의 라벨/설명, 차트 제목 등에 정확한 용어를 사용하고 싶을 때

**규칙:**
- 지식사전에서 지표명, 계산식, 용어 정의를 찾으면 **그대로 사용** (임의로 바꾸지 않음)
- 검색 결과가 없으면 무시하고 진행 (지식사전은 선택적 참조)
- tool이 없으면 (회사에 지식사전이 없음) 이 단계를 건너뜀

---

## 3. OntologyAction 실행 패턴 (CUD / 외부 API)

OntologyFunction 이 **데이터 조회 (read)** 용이라면, **OntologyAction 은 상태 변경/사이드이펙트** 용이다.
대시보드에서 데이터 생성/수정/삭제, 또는 외부 시스템 호출(이메일/슬랙/타사 REST API 등) 이 필요할 때 사용한다.

### 3.0 Action 의 의미 판단

> ⚠️ **DEPRECATED — `actionType` 은 곧 제거된다.**
> action 의 의미(생성/수정/삭제/외부 호출)는 **`displayName` / `description` / `inputs`** 로 판단한다.
> `actionType` 값에 의존해 분기하지 말고, 생성 코드의 `ACTIONS` 상수에도 `actionType` 을 넣지 말 것.
> (당분간 `list_ontology_actions` 응답에 필드는 남아 있으나 신뢰하지 말 것.)

action 이 무엇을 하는지는 `displayName` / `description` 으로 파악하고, 화면에서 채울 수 있는지는 `inputs` 스키마로 판단한다.

| 성격 | 의미 | 대시보드 UX 예시 |
|------|------|-----------------|
| 생성 | 해당 ontology 에 레코드 생성 | "신규 등록" 버튼 → form 제출 |
| 수정 | 해당 ontology 의 레코드 수정 | row 의 "수정" 액션, 인라인 편집 저장 |
| 삭제 | 해당 ontology 의 레코드 삭제 | row 의 "삭제" 버튼 (confirm 후) |
| 외부 호출 | HttpStep / Workflow 등 외부 사이드이펙트 | "재고 동기화", "슬랙 알림 보내기" 같은 액션 버튼 |

### 3.1 액션 확보 워크플로우 (재사용 우선)

OntologyFunction 과 동일한 철학 — **에이전트는 빌드 시점에 카탈로그를 보고, 새 action 을 만들지 않는다.**
(에이전트에는 `create_ontology_action` 도구가 노출되지 않는다. 액션은 운영자가 backend 에서 등록한다.)

#### Step 1. 대상 ontology 선정

`list_ontologies` 로 데이터 소스를 정하고 `ontology_id` 를 확보 (OntologyFunction 워크플로우 Step 1 과 동일).

#### Step 2. 사용 가능한 action 조회

`list_ontology_actions(ontology_object_id)` 를 호출하여 해당 ontology 에 등록된 액션 목록을 본다.

반환되는 각 action 의 필드:
- `id`: 액션 UUID (런타임 호출 시 URL 에 박는 값)
- `name` / `displayName` / `description`: 의미 식별
- `actionType`: ⚠️ **DEPRECATED (곧 제거)** — 의존 금지. 의미 판단은 `displayName`/`description`/`inputs` 로.
- `inputs`: typed input 스키마 — **단일 소스 오브 트루스**. 각 항목:
  - `name`: input 키
  - `type`: `String` | `Int` | `Boolean` | `Float` | `OntologyObject`
  - `required`: 필수 여부
  - `description`: 설명
  - `type=OntologyObject` 인 경우 추가로:
    - `ontologyObjectName`: 호출자가 PK 값을 보낼 대상 ontology
    - `primaryKeyField`: 그 ontology 의 PK 컬럼 (= 호출자가 보내는 값의 의미)
    - 그 외 `ontologyLinkId`, `matcherField` 는 백엔드 내부용 — 클라이언트는 신경쓸 필요 없음
- `expectedInputs`: 옛 best-effort 키 목록. `inputs` 가 비어있을 때만 fallback 으로 사용.

#### Step 3. 의도 매칭 판단

| 조건 | 결정 |
|------|------|
| displayName/description 이 사용자가 요구한 동작과 일치 **AND** inputs 가 화면에서 채울 수 있음 | **사용** — id 를 `ACTIONS` 상수에 박음 |
| 비슷한 동작이 있으나 inputs 가 화면에서 못 채움 (예: 사용자가 안 보는 internal id 만 요구) | **사용 안 함** — 해당 UI 빼거나 다른 대안 제시 |
| 적합한 action 이 없음 | **사용자에게 안내** — "이 동작은 현재 등록된 action 으로 처리 안 되어, 데이터 표시만 가능" |

❌ 빌드 시점에 `execute` 흉내내려고 외부 endpoint 직접 호출 시도 금지 — 그건 런타임 React 앱의 책임.
❌ 의도 일치 안 하는 action 을 억지로 끼워 넣지 말 것.

### 3.2 ACTIONS 상수 패턴

OntologyFunction 의 `FUNCTIONS` 와 동일한 패턴으로 action id 를 상수로 관리:

```tsx
// actionType 은 넣지 않는다 (deprecated). id 와 description 만 관리.
const ACTIONS = {
  create_order: {
    id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",  // list_ontology_actions 응답의 id
    description: "신규 주문 생성",
  },
  notify_slack: {
    id: "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
    description: "슬랙으로 알림 전송 (HttpStep)",
  },
};
```

### 3.3 런타임 호출 패턴

생성된 React 앱은 **`POST /ontology-actions/{actionId}/execute`** 를 `apiClient` 로 호출한다.
`/internal/` 경로가 아니라 사용자 facing controller — JWT 인증은 `useApiClient()` 가 자동 처리하고, **tenant 식별은 `X-Tenant-Id` 헤더로 명시 전달** (§2.4a 참고).

```tsx
// CORRECT — 레코드 생성(create) 액션 예시
const response = await apiClient.post(
  `/ontology-actions/${ACTIONS.create_order.id}/execute`,
  {
    input: {
      customer_id: 123,        // type=Int input
      product_name: "Widget",  // type=String input
      quantity: 2,
    },
  },
  { headers: { "X-Tenant-Id": TENANT_ID } }
);

// type=OntologyObject 인 input 은 primaryKeyField 의 값 한 개만 — backend 가 link 따라 자동 변환
const response = await apiClient.post(
  `/ontology-actions/${ACTIONS.assign_reviewer.id}/execute`,
  {
    input: {
      pr: 4521,                // PR ontology 의 PK 값만
      reviewer: "yunsang",
    },
  },
  { headers: { "X-Tenant-Id": TENANT_ID } }
);
```

### 3.4 응답 구조 및 status 별 UX

```typescript
// response.data.data:
{
  "id": "<runId>",
  "actionId": "...",
  "actionName": "create_order",
  "status": "SUCCESS" | "FAIL" | "WAITING_CALLBACK",
  "stepResults": [
    { "key": "...", "type": "...", "status": "SUCCESS", "output": { ... } },
    ...
  ],
  "error": null | "..."
}
```

| status | UX 처리 |
|--------|---------|
| `SUCCESS` | 성공 토스트 + 관련 데이터 재조회 (`fetchData()` 다시 호출하거나 mutate). `stepResults[].output` 에 의미있는 값이 있으면 활용. |
| `FAIL` | 에러 토스트에 `response.data.error` 를 그대로 표시. row state 는 롤백. |
| `WAITING_CALLBACK` | "비동기 처리 중" 안내. 즉시 결과 반영하지 말 것. 필요하면 `GET /ontology-actions/runs/{runId}` 로 폴링 (긴 콜백은 비추 — 단순히 안내 후 사용자가 새로고침). |

### 3.5 호출 예시 — UPDATE / DELETE

```tsx
// UPDATE
const handleSave = useCallback(async (row: any, edited: any) => {
  try {
    const res = await apiClient.post(
      `/ontology-actions/${ACTIONS.update_order_status.id}/execute`,
      { input: { order: row.id, status: edited.status } },
      { headers: { "X-Tenant-Id": TENANT_ID } }
    );
    if (res?.data?.status === "SUCCESS") {
      await fetchData();
    } else {
      console.error("Action FAIL:", res?.data?.error);
    }
  } catch (e) {
    console.error("Action error:", e);
  }
}, [apiClient]);

// DELETE — 사용자 confirm 후 호출
const handleDelete = useCallback(async (row: any) => {
  if (!window.confirm("정말 삭제할까요?")) return;
  const res = await apiClient.post(
    `/ontology-actions/${ACTIONS.delete_order.id}/execute`,
    { input: { order: row.id } },
    { headers: { "X-Tenant-Id": TENANT_ID } }
  );
  if (res?.data?.status === "SUCCESS") {
    await fetchData();
  }
}, [apiClient]);
```

### 3.6 호출 예시 — CUSTOM (외부 API / 워크플로우)

CUSTOM 액션은 backend 가 HttpStep 으로 외부 시스템(슬랙/이메일/타사 REST) 을 호출하거나 Workflow 를 실행한다.
클라이언트 입장에서는 **그냥 동일한 execute 호출** — backend 가 내부 step graph 를 알아서 돌린다.

```tsx
const handleNotify = useCallback(async () => {
  const res = await apiClient.post(
    `/ontology-actions/${ACTIONS.notify_slack.id}/execute`,
    { input: { channel: "#alerts", message: "재고 부족 경고" } },
    { headers: { "X-Tenant-Id": TENANT_ID } }
  );
  // SUCCESS / WAITING_CALLBACK 모두 가능 — webhook 모드면 WAITING_CALLBACK
  if (res?.data?.status === "WAITING_CALLBACK") {
    // "외부 시스템 처리 중" 안내
  }
}, [apiClient]);
```

### 3.7 FORBIDDEN PATTERNS (Action 관련)

❌ 절대 사용 금지:
- 빌드 시점에 에이전트가 `execute_ontology_action` 같은 도구로 직접 액션을 실행하는 것 — 그런 도구는 노출되지 않으며, 시도해도 안 됨.
- `/internal/ontology-actions/...` 경로 호출 — 사용자 JWT 로 인증 불가. 반드시 `/ontology-actions/...` (no internal prefix).
- input 에 `type=OntologyObject` 인 필드에 record 전체 객체를 넣기 — primaryKeyField 의 단일 PK 값만 보낼 것.
- 같은 의도의 action 이 있는데 OntologyFunction 으로 read+컴포넌트 내부에서 mutation 시도 — function 은 read-only 용도.
- WAITING_CALLBACK 인데 즉시 SUCCESS 인양 fetchData 호출 — 결과 아직 미반영.
- `apiClient.post(url, body)` 처럼 3번째 인자(`{ headers: { "X-Tenant-Id": TENANT_ID } }`) 누락 — app-api-v2 가 거부할 수 있음 (§2.4a 참조).

---

## 4. Code Generation Patterns

### 4.1 Complete App.tsx Structure

> The example below shows the **data + code structure** (api client, FUNCTIONS/TENANT_ID
> constants, fetch + transform + state). UI component imports and JSX are intentionally left
> as placeholders — **fill them using the components, imports, and tokens from `.cos/DESIGN.md`.**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useApiClient } from "@/api/api.client";

// Design-system components, chart components, and styling tokens:
// import them exactly as `.cos/DESIGN.md` specifies. Do not assume a library here.
// import { ... } from "<per DESIGN.md>";

// Lucide icons (only names from the allowlist in §5.8)
import { ShoppingCart, TrendingUp, Package } from "lucide-react";

// Chart colors — hex only (charting libs cannot resolve CSS variables / oklch / hsl).
// Use the palette DESIGN.md recommends; this is a neutral fallback set.
const CHART_COLORS = ["#3b82f6", "#10b981", "#eab308", "#ef4444", "#a855f7", "#14b8a6", "#ec4899", "#84cc16"];

// 1. FUNCTIONS constant — OntologyFunction IDs from create_ontology_function
const FUNCTIONS = {
  order_summary: {
    id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    description: "주문 집계 데이터",
  },
  product_list: {
    id: "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
    description: "상품 목록",
  },
};

// 1a. TENANT_ID — [Tenant Context] 의 tenant_id 를 그대로 박는다 (§2.4a)
const TENANT_ID = "123";  // 예: 사용자 메시지의 [Tenant Context] tenant_id=123 인 경우

export default function App() {
  // 2. API client (MUST be called at top of component)
  const apiClient = useApiClient();

  // 3. State declarations
  const [isLoading, setIsLoading] = useState(false);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [chartData, setChartData] = useState<any[]>([]);
  const [tableData, setTableData] = useState<any[]>([]);

  // 4. Column definitions (TanStack ColumnDef format)
  const columns = [
    {
      accessorKey: "product_name",
      header: ({ column }: any) => <DataTableColumnHeader column={column} title="상품" />,
    },
    {
      accessorKey: "amount",
      header: ({ column }: any) => <DataTableColumnHeader column={column} title="금액" />,
      cell: ({ row }: any) => `₩${row.getValue("amount")?.toLocaleString() || 0}`,
    },
  ];

  // 5. Data fetching with Promise.all
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const tenantHeader = { headers: { "X-Tenant-Id": TENANT_ID } };
      const [aggResponse, rowResponse] = await Promise.all([
        apiClient.post(
          `/ontology-functions/${FUNCTIONS.order_summary.id}/run`,
          { parameters: {} },
          tenantHeader
        ),
        apiClient.post(
          `/ontology-functions/${FUNCTIONS.product_list.id}/run`,
          { parameters: { offset: 0, limit: 100 } },
          tenantHeader
        ),
      ]);

      // 6. Data transformation
      const aggData = aggResponse?.data?.data?.result || [];
      const total = aggData.reduce((sum: number, item: any) => sum + (item?.amount || 0), 0);
      setTotalRevenue(total);

      const chart = aggData
        .map((item: any) => ({ date: item.date, amount: item.amount || 0 }))
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 50);
      setChartData(chart);

      const rows = rowResponse?.data?.data?.result || [];
      setTableData(Array.isArray(rows) ? rows.filter((r: any) => r && typeof r === "object") : []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [apiClient]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 7. JSX — follow the Layout Rules (§1) for region order, and `.cos/DESIGN.md`
  //    for the concrete components (cards/charts/table), their props, and tokens.
  //    The skeleton below marks WHERE each piece goes; DESIGN.md defines WHAT to use.
  return (
    <div className="overflow-auto flex-1 min-w-0 h-full">
      <div className="flex flex-col gap-6">
        {/* Page header: title + description (components/tokens per DESIGN.md) */}
        <header> ... </header>

        {/* KPI region: render `totalRevenue` in a metric card (per DESIGN.md) */}
        <section className="grid"> ... </section>

        {/* Charts region: render `chartData` with a chart component (per DESIGN.md).
            Pass `colors={CHART_COLORS}` and a stable `key` so the chart re-renders on data change. */}
        <section className="grid"> ... </section>

        {/* Table region: render `tableData`/`columns` with a data table (per DESIGN.md) */}
        <section> ... </section>
      </div>
    </div>
  );
}
```

### 4.2 Import Statement Rules

Always combine into minimal import groups. The **design-system** imports (components,
charts, helpers) are defined by `.cos/DESIGN.md` — use exactly the import paths it specifies.
The neutral, design-independent imports are:

```tsx
// React core (no `import React` — modern JSX transform)
import { useState, useEffect, useCallback } from 'react';

// API client (always this exact path — see §4.3)
import { useApiClient } from "@/api/api.client";

// Design-system components / charts / helpers — import per `.cos/DESIGN.md`
// import { ... } from "<per DESIGN.md>";

// Lucide icons (only names from the allowlist in §5.8)
import { ShoppingCart, TrendingUp, Package } from "lucide-react";
```

### 4.3 useApiClient Pattern

```tsx
const apiClient = useApiClient();
```

- MUST be called at the TOP of the App component
- Automatically configures Bearer token injection via axios interceptor
- Do NOT manually add Authorization headers (auto-injected) — **단, `X-Tenant-Id` 는 예외로 매 호출마다 명시 전달** (§2.4a)
- Token is cached and refreshed automatically on 401 errors

### 4.4 API URL Pattern

**ALWAYS** use relative path (apiClient has baseURL configured), **AND 모든 호출에 `X-Tenant-Id` 헤더 포함**:

```tsx
// CORRECT -- relative path + X-Tenant-Id
apiClient.post(
  `/ontology-functions/${FUNCTIONS.xxx.id}/run`,
  { parameters: { date_from: "...", date_to: "..." } },
  { headers: { "X-Tenant-Id": TENANT_ID } }
)

// FORBIDDEN -- hardcoded URL
apiClient.post('https://app-api-v2.commerceos.ai/ontology-functions/...', ...)

// FORBIDDEN -- import.meta.env
apiClient.post(`${import.meta.env.VITE_API_BASE_URL}/ontology-functions/...`, ...)

// FORBIDDEN -- X-Tenant-Id 누락
apiClient.post(`/ontology-functions/${id}/run`, { parameters: {...} })
```

### 4.5 Request Body

세 번째 인자(axios config)로 `X-Tenant-Id` 헤더를 함께 전달한다.

```tsx
const tenantHeader = { headers: { "X-Tenant-Id": TENANT_ID } };

// CORRECT — 집계 함수 (supports_pagination=False)
apiClient.post(url, { parameters: { date_from: "...", date_to: "..." } }, tenantHeader)

// CORRECT — 목록 함수 (supports_pagination=True) → offset/limit 필수
apiClient.post(url, { parameters: { date_from: "...", date_to: "...", offset: 0, limit: 20 } }, tenantHeader)

// FORBIDDEN — pagination 함수에서 offset/limit 누락 (서버 에러 발생)
apiClient.post(paginatedUrl, { parameters: { date_from: "...", date_to: "..." } }, tenantHeader)

// FORBIDDEN — X-Tenant-Id 헤더 누락 (app-api-v2 가 거부)
apiClient.post(url, { parameters: {...} })
```

### 4.6 Data Transformation Patterns

#### KPI Values (Single Numbers) — use `.reduce()`

```tsx
// CORRECT: .reduce() produces a single number
const totalRevenue = aggData.reduce(
  (sum: number, item: any) => sum + (item?.amount || 0), 0
);

// WRONG: .map() produces an array, not a number!
const totalRevenue = aggData.map(item => item?.amount || 0);
```

#### Chart Data — use `.map()` then `.sort()` then `.slice()`

```tsx
const chartData = aggData
  .map((item: any) => ({
    date: item.date,
    revenue: item.amount || 0,
  }))
  .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
  .slice(0, 50); // MANDATORY: limit to 50 items max
```

#### Pie Chart Data — transform to `{ name, value }[]`

```tsx
const pieData = aggData.map((item: any) => ({
  name: String(item._id || "Unknown"),
  value: item.count || 0,
}));
```

#### countOfColumnUnique Handling

```tsx
// Define extractCount as an inline helper in App.tsx
const extractCount = (item: any): number => {
  if (item?.count != null) return Number(item.count);
  const countKey = Object.keys(item || {}).find((k) => k.startsWith("countOfColumnUnique"));
  return countKey ? Number(item[countKey]) || 0 : 0;
};

// Usage
const uniqueCount = extractCount(item);
const total = aggData.reduce((sum: number, item: any) => sum + extractCount(item), 0);
```

#### Array Type Fields in Tables

If an ontology field is of type Array, never render it directly. Flatten by extracting primitive sub-fields:

```tsx
news_title: item.news?.[0]?.news_title || '',
news_url: item.news?.[0]?.news_url || '',
```

### 4.7 useEffect Dependencies

```tsx
const fetchData = useCallback(async () => { ... }, [apiClient, period]);

useEffect(() => {
  fetchData();
}, [fetchData]);
```

### 4.8 Null Safety

Always use optional chaining and fallback values:

```tsx
const aggData = response?.data?.data?.result || [];
const value = item?.amount ?? 0;
const name = item?.product_name || "Unknown";
```

---

## 5. Forbidden Patterns

### 5.1 Forbidden File Operations

- **NEVER include `package.json`** in the output.
- **NEVER create new component files** under `src/components/`.
- **NEVER modify or redefine** existing files other than `src/App.tsx`.
- The ONLY file you are allowed to output is `src/App.tsx`.

### 5.2 Forbidden API Patterns

- **NEVER hardcode URLs**: `apiClient.post('https://...')`
- **NEVER manually add Authorization headers** — `useApiClient()` handles this
- **MUST include `X-Tenant-Id` header** on every `apiClient` call to `/ontology-functions/*` and `/ontology-actions/*` (app-api-v2 정식 spec). 값은 `TENANT_ID` 상수에서 가져온다 (§2.4a). 누락 시 backend 가 요청을 거부할 수 있음.
- **NEVER use `localStorage.getItem("token")`** to get tokens manually
- **NEVER import useApiClient from wrong paths** — the ONLY correct import is:
  `import { useApiClient } from "@/api/api.client"`
  Do NOT use `@/lib/api`, `@/api`, `@/lib/commerce-sdk`, or any other path.

### 5.3 Forbidden UI Patterns

These rules are design-system independent. **Component import paths, chart/table/date-picker
APIs, and any "use X not Y" component rules are defined by `.cos/DESIGN.md`** — follow it.

- **NEVER** import anything from `@/components/patterns` or `@/components/ui` — these directories do not exist. All UI components come from the design system specified in `.cos/DESIGN.md`.
- **NEVER** use legacy pattern components/helpers (`DynamicBarChart`, `DynamicLineChart`, `DynamicPieChart`, `StatCard`, `PageHeader`, `Grid`, `ChartCard`, `EditableText`, `DatePeriodSelector`, `getDateRangeFromPeriod`, `extractCount`, `DatePeriodValue`) — define helpers inline if needed.
- **NEVER** add `import React` — the project uses modern JSX transform. Import only named hooks: `import { useState, useEffect } from 'react'`.
- **NEVER** add a button that manually triggers a data fetch function when that function is already called automatically via `useEffect`. If a component (e.g. a date filter) updates state that `useEffect` depends on, data is already re-fetched on every change — adding a separate refresh button duplicates the same trigger and must be avoided. See section 2.5 for the correct date-filter + useEffect pattern.

### 5.4 Forbidden Layout Patterns

- **NO `min-h-screen`** or `h-screen` on root elements
- **NO "Not running in iframe"** error banners
- **NO** assuming control of body or full viewport

### 5.5 Forbidden Data Patterns

- **NEVER hardcode dates** in queries
- **NEVER use `.map()` for KPI single values** — use `.reduce()`
- **NEVER render Array-type fields directly** — flatten to primitive sub-fields
- **NEVER import from `@/components/patterns`** — define `extractCount` and other helpers inline in App.tsx
- **NEVER exceed 50 items in chart data** — always `.slice(0, 50)` after sorting

### 5.6 Forbidden Styling Patterns

Styling tokens (colors, typography, spacing) belong to the active design system —
**see `.cos/DESIGN.md` for the authoritative Do's/Don'ts and the exact token names.**
Design-system-independent rules:
- **NEVER** hardcode hex color values in `className` — use the design system's semantic color tokens (per DESIGN.md).
- **NEVER** use raw default Tailwind colors (e.g. `text-blue-500`, `bg-gray-100`) — use the design system's semantic tokens (per DESIGN.md).
- **NEVER** use raw Tailwind font-size utilities (e.g. `text-sm`, `text-base`) — use the design system's typography tokens (per DESIGN.md).

### 5.7 Forbidden Library Usage

Only use libraries already installed in the sandbox's `package.json`. These are available
in **every** mode (verify with `read_file("/app/view-gen/package.json")` if unsure):

- `react`, `react-dom`
- `lucide-react` (icons — see §5.8 allowlist)
- `recharts` (charting — use directly when the active design system tells you to)
- `@tanstack/react-table` (table logic)
- `axios`, `zod`, `@hookform/resolvers`
- `clsx`, `tailwind-merge`, `class-variance-authority`, `next-themes`, `sonner`

The **active design system** (`.cos/DESIGN.md`) decides WHICH of these to use for UI:
e.g. a synapse-style mode wraps charts/tables in its own component library, while `free`
mode uses `recharts` directly + plain Tailwind. **Use exactly what DESIGN.md specifies** —
but anything it tells you to import MUST be one of the installed packages above (or a
package its own `package.json`/DESIGN.md confirms is present).

Do NOT import a library that is not installed. Do NOT add new dependencies. If DESIGN.md
references a package you cannot find in `package.json`, prefer the closest installed
equivalent rather than silently dropping the feature (e.g. don't remove a chart entirely —
`recharts` is always available).

### 5.8 Forbidden Lucide Icons

**ONLY** the following icon names are verified to exist in the sandbox's lucide-react version.
Using **ANY** icon name outside this list **WILL cause a blank screen** (import error = entire app fails to render):

`Activity`, `AlertCircle`, `BarChart`, `BarChart3`, `Calendar`, `Check`, `ChevronDown`, `Circle`, `CreditCard`, `DollarSign`, `FileText`, `Home`, `Info`, `LayoutDashboard`, `Mail`, `Menu`, `Package`, `Search`, `Settings`, `ShoppingCart`, `TrendingUp`, `User`, `X`, `Plus`, `Minus`, `Edit`, `Trash`

This is an **exhaustive allowlist**, not examples. Icons like `Star`, `Smile`, `Frown`, `MessageSquare`, `Heart`, `Bell`, `ArrowRight` etc. may exist in other versions but are **NOT available** in this sandbox and will break the app.

When in doubt, use `DollarSign` or `CreditCard` for financial icons, `Check` or `AlertCircle` for status icons.

### 5.9 Code Modification Rules

When modifying existing code (not generating from scratch):

- The existing code is the SINGLE source of truth
- Make ONLY the minimal, surgical change requested
- Do NOT rewrite overall structure
- Do NOT reorganize imports or state declarations
- Do NOT rename variables, functions, or components
- Do NOT add features that were not asked for
- Do NOT "clean up" or "improve" unrelated code

## 6. Component Identification (`data-aos-id`)

The host UI lets the user click a rendered component in the preview to scope
their next modification to just that component. This works by reading
`data-aos-id` attributes from the live DOM, so every top-level component MUST
carry one and the values MUST stay stable across modifications.

### 6.1 Required attributes

For every top-level React component defined in `App.tsx` (each named function
or `const X = () => ...` that represents a discrete unit the user would think
of as a piece of the dashboard), the OUTERMOST JSX element returned by that
component must include:

- `data-aos-id="<kebab-case>"` — derived from the component name.
- `data-aos-name="<PascalCase>"` — the component's original name, so the host
  UI can show a human-readable label without conversion logic.
- `data-aos-functions="<uuid>[,<uuid>...]"` — the `id` values from the `FUNCTIONS`
  constant that THIS component calls to fetch its data. The host uses these to
  inspect the component's ontology resources (query + ontology meta + sample).
  - **Single attribute, comma-separated inside one set of quotes** when a
    component uses multiple functions: write `data-aos-functions="a,b"`
    (one attribute, ids joined by commas) — NOT `data-aos-functions="a" data-aos-functions="b"`
    and NOT separate attributes. The host splits the string on `,`.
  - Omit (or leave empty `""`) for pure layout/header components that fetch nothing.
  - Each value MUST be a UUID that exists in the `FUNCTIONS` constant —
    `verify_scope` rejects malformed tokens and ids not declared in `FUNCTIONS`.

Examples:

```tsx
// Single function.
// (The outermost element is whatever the design system uses for a card — per DESIGN.md.
//  The data-aos-* attributes go on that outermost element, regardless of which component it is.)
function KPICard({ value }: { value: number }) {
  return (
    <CardComponent
      data-aos-id="kpi-card"
      data-aos-name="KPICard"
      data-aos-functions="019e49aa-fe82-75ca-bbdd-8a2c0432fc71"
    >
      ...
    </CardComponent>
  );
}

// Multiple functions in one component → comma-separated in a SINGLE attribute
function SalesOverview() {
  return (
    <CardComponent
      data-aos-id="sales-overview"
      data-aos-name="SalesOverview"
      data-aos-functions="019e49aa-fe82-75ca-bbdd-8a2c0432fc71,019e49aa-fe7e-76c6-96b8-192b7e564a17"
    >
      ...
    </CardComponent>
  );
}

const SalesChart = () => (
  <div data-aos-id="sales-chart" data-aos-name="SalesChart">
    ...
  </div>
);

function MonthlyRevenueWidget() {
  return (
    <section data-aos-id="monthly-revenue-widget" data-aos-name="MonthlyRevenueWidget">
      ...
    </section>
  );
}
```

### 6.2 Which components get an id

There are two separate questions: **which units need an id** (a judgement call)
and **where the id physically goes** (a mechanical rule). Keep them distinct.

**(a) Semantic criterion — which units need an id**

A unit needs an id if the user could click it in the preview and say "change
THIS one" — i.e. a self-contained visual block they would point at.

- ✅ Anything the user would call out as a card, chart, table, filter bar,
  header, sidebar, KPI, etc.
- ✅ Top-level layout regions (`Sidebar`, `MainPanel`, `Header`).
- ❌ Pure presentational helpers used only inside another component
  (a one-line `<Row>` rendered inside a table body, a `<Cell>` formatter).
- ❌ The root `App` component itself (but see (c) for the last-resort fallback).

Rule of thumb: if a user might say "change THAT", the thing they're pointing
at needs an id.

**(b) Structural rule — how each unit must be expressed**

Every unit identified in (a) MUST exist as its own **named top-level component
function** — NOT as an inline `<div>` block buried inside `App`. The
`data-aos-id` / `data-aos-name` attributes go on the **outermost JSX element**
that component returns.

The invariant that follows (and that verification checks):

> every named top-level component except `App` carries exactly one
> `data-aos-id`, so `# of id-worthy units == # of named top-level components
> (excluding App) == # of data-aos-id attributes`.

**(c) When there seems to be nowhere to put an id**

If you cannot find a top-level component to attach `data-aos-id` to, that is
usually a signal your UI is not split into components — everything is inlined
in `App`. This is the most common cause of "no data-aos-id" failures.

The PREFERRED fix is to **extract** each id-worthy unit (per (a)) into its own
named top-level component and attach the id there:

```tsx
// ❌ WRONG: everything inlined in App, nowhere "real" to put an id
export default function App() {
  return (
    <div className="dashboard">
      <div className="chart-box">...</div>   {/* a chart, but not a component */}
      <div className="card-box">...</div>    {/* a card, but not a component */}
    </div>
  );
}

// ✅ PREFERRED: extract each unit into a named component, id on its outermost JSX
export default function App() {              // App root — no id when units exist
  return (
    <div className="dashboard">
      <SalesChart data={salesData} />
      <RevenueCard value={totalRevenue} />
    </div>
  );
}

function SalesChart({ data }) {
  return (
    <div className="chart-box" data-aos-id="sales-chart" data-aos-name="SalesChart">
      ...
    </div>
  );
}

function RevenueCard({ value }) {
  return (
    <div className="card-box" data-aos-id="revenue-card" data-aos-name="RevenueCard">
      ...
    </div>
  );
}
```

**Last-resort fallback:** for a genuinely single-unit app (one screen with no
distinct, separately-targetable regions to extract — e.g. a simple calculator
or a one-card view), put a single `data-aos-id` on the `App` root's outermost
JSX element. An id on `App` is far better than none: with zero ids the host
preview cannot target anything at all, whereas an `App`-level id at least makes
the whole app selectable. Use this ONLY when extraction genuinely does not
apply — never to silence the check on an app that has multiple distinct units.

### 6.3 Stability on modification — DO NOT BREAK IDS

The host UI sends the user's selected ids back in the next prompt as
`[Target Components]`. Breaking ids breaks the user's saved selection.

- NEVER change the value of an existing `data-aos-id`.
- NEVER remove `data-aos-id` from a component you are keeping.
- New component → new unique kebab-case id.
- Deleted component → remove its JSX subtree entirely (no empty shell).
- Keep `data-aos-functions` in sync with the component's actual `FUNCTIONS` usage —
  add/remove an id when you add/remove a data fetch in that component.

#### Adding new UI on a modification — it MUST be selectable

When the user asks to ADD something (e.g. "add another chart", "add a summary
card"), the new UI MUST end up selectable in the preview. The host can only
select a node that has a `data-aos-id`, or a descendant of such a node (it walks
up to the nearest ancestor with `data-aos-id`). So exactly ONE of these must
hold for whatever you add:

- ✅ **It becomes its own new top-level component** with its own
  `data-aos-id` + `data-aos-name` on its outermost JSX (the normal case for a
  new chart/card/table the user would point at). This is REQUIRED whenever the
  added thing is a unit the user could say "change THAT" about.
- ✅ **It is nested inside an existing component that already has a
  `data-aos-id`**, so the user selects it via that ancestor. Fine for small
  additions that are genuinely part of an existing block (e.g. a new row inside
  an already-identified table).

- ❌ **NEVER add a new region that has no `data-aos-id` and is NOT inside any
  element that has one.** That produces a chart/card the user can SEE but can
  never click to modify — a permanent dead zone. If you find yourself adding a
  new top-level block, it needs its own id.

Concretely: "add another chart" → create a new named component (e.g.
`RevenueByRegionChart`) with `data-aos-id="revenue-by-region-chart"` on its
outermost JSX, and render it from `App`. Do NOT drop a bare `<div><Chart/></div>`
into `App` with no id.

While you are editing `App.tsx`, if you happen to notice an EXISTING top-level
component that is missing its `data-aos-id` (left over from an earlier build),
add one to it too — this self-heals previously unselectable components.

### 6.4 Handling `[Target Components]` in the user message

If the agent_message contains a `[Target Components]` block listing component
names with their `data-aos-id`s, the user explicitly asked to scope changes
to those components.

1. `read_file("/app/view-gen/src/App.tsx")` first.
2. Modify ONLY the JSX/logic INSIDE the listed components. Other components'
   JSX, hooks, queries, imports, and styles must remain byte-identical.
3. Use `edit_file` (not `write_file`) so a full rewrite cannot accidentally
   touch unrelated regions.
4. If the user's request inherently affects other components (e.g., "add a
   filter that all charts use"), do the smallest necessary additions outside
   the target and note the spillover in the HISTORY.md entry.
