# AgentOS 앱 로컬 개발 — 이 문서를 먼저 읽는다

아래에 이어지는 `Coding Guide` 는 **앱빌더 제품의 에이전트를 위해 쓰인 문서**를 그대로 가져온 것이다. 그 에이전트는 샌드박스 파일 툴만 갖고, 런타임 검증도 브라우저도 없으며, App.tsx 한 파일에만 쓴다.

너는 그 에이전트가 아니다. 그래서 그 문서는 두 종류가 섞여 있고 취급이 다르다.

- **계약** — 지키지 않으면 제품 안에서 앱이 깨진다. 그대로 따른다
- **하네스 처방** — 그 에이전트의 한계를 우회하려고 쓴 규칙. 너에게는 적용되지 않는다

## 적용되지 않는 것 (근거 포함)

**§0 코드 탐색 절차 전체.** 거기 나오는 `list_files` / `search_files` / `read_file(path, offset, limit)` / `edit_file` 은 제품 전용 툴 이름이고 너에게는 없다. "큰 파일을 통째로 읽지 마라, 한계를 넘으면 작업 전체가 실패한다" 는 그 하네스의 컨텍스트 제약이지 일반 규범이 아니다. 평소 방식대로 Glob, Grep, Read, Edit 를 쓴다.

**§5.1 의 단일 파일 제약.** "App.tsx 외 파일 수정 금지", "`src/components/` 새 파일 금지" 는 따르지 않아도 된다. 앱 규모에 맞게 파일을 나눈다.

근거: 제품의 `track_resource_usage` 는 `src/` 를 **재귀 순회**하며 `.ts` / `.tsx` / `.js` / `.jsx` 전부를 모아 `FUNCTIONS` / `ACTIONS` 선언을 수집한다. 어느 파일에 두든 잡히므로 리소스 추적이 깨지지 않는다.

대가는 알고 있어야 한다. 제품의 `verify_scope` 는 App.tsx 만 비교하므로, 이후 사용자가 제품 챗에서 타겟 수정을 하면 다른 파일의 변경을 범위 검증이 보지 못한다. 깨지지는 않고 그쪽 검증이 느슨해진다.

**§4.1 Complete App.tsx Structure.** 단일 파일 스켈레톤이다. 참고 자료로 읽고 구조는 직접 정한다.

**§5.1 의 "NEVER include package.json in the output".** 제품의 출력 형식 제약이라 무관하다. 다만 **의존성 추가는 신중히** 한다 — 온프렘 환경은 `SANDBOX_OFFLINE=true` 로 복원 후 `npm install` 을 건너뛰므로, 이미지에 없는 패키지를 추가하면 그 환경에서 깨진다.

## 반드시 지키는 계약

| 구간 | 내용 |
|---|---|
| §1 | Layout root structure, iframe 규칙 |
| §2 | OntologyFunction 데이터 조회 패턴 |
| §3 | OntologyAction 실행 패턴 |
| §4.2~4.5 | import 경로, `useApiClient`, API URL, request body |
| §5.2 | `X-Tenant-Id` 헤더 필수, 토큰 수동 취급 금지, URL 하드코딩 금지 |
| §5.3 | 없는 경로 import 금지, legacy 컴포넌트 금지, `import React` 금지 |
| §5.4 | `min-h-screen` / `h-screen` 금지 등 iframe 레이아웃 (배포 후에도 iframe 안에서 뜬다) |
| §6 | `data-aos-id` 태깅 — 제품이 파싱하는 대상이다 |

`const TENANT_ID` / `const FUNCTIONS` / `const ACTIONS` 선언은 특히 중요하다. 이 형태가 아니면 제품이 앱의 의존성을 파싱하지 못한다.

## 네가 추가로 하는 것

제품 에이전트에게 없는 능력이다. 쓰지 않으면 이 경로를 쓸 이유가 없다.

**런타임 검증.** 타입 체크로 끝내지 않는다. `npm run dev` 로 띄우고 브라우저에서 실제로 동작을 확인한다. 콘솔 에러와 네트워크 응답을 본다. 데이터가 실제로 그려지는지, 액션이 실제로 실행되는지 확인한다.

```
npm run dev
http://localhost:3000/?token=<access token>
```

토큰은 `appgen open` 이 키체인에서 읽어 URL 을 만들고 브라우저를 띄운다. 토큰 값을 직접 다루지 않는다.

**구조화.** 앱이 커지면 파일을 나눈다. 컴포넌트, 훅, 타입, API 호출을 분리한다.

**HISTORY.md 는 직접 편집하지 않는다.** `.cos/HISTORY.md` 는 `appgen push` 가 번호와 날짜를 부여해 EOF 에 append 한다. 직접 쓰면 번호가 꼬인다 (제품에서 실제로 관측된 문제다).

## 환경과 데이터 접근

**dev 전용이다.** app-api 는 `https://app-api-v2-dev.commerceos.ai` 로 고정되어 있고 변경 수단이 없다.

**DB 에 직접 붙지 않는다.** 온톨로지 펑션과 액션만 경유한다. 선택이 아니라 구조적 강제다 — 행 CUD 는 액션이 유일한 경로다.

**애드혹 SQL 은 3-part FQN 이 필수다.** 실행 엔진은 **Spark** 이므로 SparkSQL 문법으로 쓴다 (Swagger 의 StarRocks 설명은 낡았다).

```
catalog_{companyId}.{collection}.{objectName}
```

bare 테이블명은 실패하고 2-part 도 거부된다. FQN 조립에 필요한 값은 객체 상세 조회의 `catalogName`, `collection`, `name` 이다.

**펑션 저장 경로는 다르다.** `POST /ontology-functions` 는 `qualifyLakeTableRefs` 가 FROM 을 자동으로 3-part 로 정규화해준다. 애드혹 쿼리만 수동으로 써야 한다.

---
