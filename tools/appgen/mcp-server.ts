#!/usr/bin/env node
/**
 * 온톨로지 MCP 서버 — 에이전트가 쓰는 도구 표면.
 *
 * ## 왜 MCP 이고 CLI 서브커맨드가 아닌가
 *
 * Claude Code 는 MCP 툴별로 allow/ask 를 걸 수 있고, 툴 추가가 정의 파일에 드러난다.
 * CLI 서브커맨드는 암묵적으로 늘어나 결국 CUD 구멍이 생긴다 (사용자 판단).
 *
 * ## 왜 MCP SDK 를 쓰지 않는가
 *
 * 이 도구는 **앱 템플릿 레포 안에** 있다. `package.json` 에 의존성을 추가하면 생성되는 모든
 * 앱과 제품 샌드박스로 따라가고, 온프렘은 `SANDBOX_OFFLINE=true` 로 `npm install` 을
 * 건너뛰므로 이미지에 없는 패키지는 그 환경에서 앱을 깨뜨린다 (호환성 계약).
 * 그래서 stdio JSON-RPC 2.0 을 직접 구현한다 — 필요한 메서드가 셋뿐이라 값싸다.
 *
 * ## stdout 은 프로토콜 전용이다
 *
 * 로그를 stdout 에 쓰면 전송이 깨진다. 모든 진단은 **stderr** 로 보낸다.
 *
 * ## 테넌트와 환경은 인자로 받지 않는다
 *
 * 앱 디렉토리의 `.cos/appgen.json` 에서 읽는다. 매 호출에 18자리 테넌트 id 를 넘기게 하면
 * 오타 한 번이 "권한 없음" 으로 위장한다 (실측: snowflake id 정밀도 손실이 403 으로 나타남).
 *
 * ## 쓰기는 하나뿐이다
 *
 * `create_function` 만 테넌트에 영속한다. 제품 앱빌더와 정확히 같은 선이다 (`ontology.ts` 주석).
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { appEnv, readMeta } from './env.ts'
import {
  buildFqn,
  createFunction,
  getObjectDetail,
  listActionRuns,
  listActions,
  listCollectionEntities,
  listCollections,
  listFunctions,
  listLinks,
  listObjectRecords,
  listObjects,
  querySql,
  runFunction,
  type OntologyRef,
} from './ontology.ts'

const SERVER_NAME = 'aos-ontology'
const SERVER_VERSION = '1.0.0'
/** 클라이언트가 버전을 안 보낼 때만 쓰는 값. 보통은 클라이언트 것을 되돌려준다. */
const FALLBACK_PROTOCOL_VERSION = '2025-06-18'

type Json = Record<string, unknown>

interface ToolDef {
  name: string
  description: string
  inputSchema: Json
  run: (ref: OntologyRef, args: Json) => Promise<unknown>
}

// ── 인자 헬퍼 ────────────────────────────────────────────────────────────────

function requireString(args: Json, key: string): string {
  const value = args[key]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${key} 는 비어 있지 않은 문자열이어야 합니다.`)
  }
  return value
}

/** id 는 항상 문자열로 받는다 — 숫자로 오면 이미 정밀도가 깨진 뒤다. */
function requireId(args: Json, key: string): string {
  const value = args[key]
  if (typeof value === 'number') {
    throw new Error(
      `${key} 를 숫자로 보냈습니다. AgentOS id 는 64비트라 JS number 로 담으면 하위 자릿수가 ` +
        `조용히 뭉개집니다 (서버는 "찾을 수 없습니다" 로 답해 권한 문제처럼 보입니다). 문자열로 보내세요.`,
    )
  }
  return requireString(args, key)
}

const ID_SCHEMA = {
  type: 'string',
  description: '64비트 id. **문자열로** 보낼 것 — 숫자로 보내면 정밀도가 손실된다',
}

// ── 툴 정의 ──────────────────────────────────────────────────────────────────

const TOOLS: ToolDef[] = [
  {
    name: 'list_collections',
    description: '온톨로지 컬렉션 목록. 데이터 탐색의 시작점이다.',
    inputSchema: { type: 'object', properties: {} },
    run: (ref) => listCollections(ref),
  },
  {
    name: 'list_collection_entities',
    description: '한 컬렉션에 속한 객체·링크 목록.',
    inputSchema: {
      type: 'object',
      properties: { collectionId: ID_SCHEMA },
      required: ['collectionId'],
    },
    run: (ref, args) => listCollectionEntities(ref, requireId(args, 'collectionId')),
  },
  {
    name: 'list_objects',
    description: '테넌트의 온톨로지 객체 전체 목록.',
    inputSchema: { type: 'object', properties: {} },
    run: (ref) => listObjects(ref),
  },
  {
    name: 'get_object_detail',
    description:
      '객체의 스키마(structure)와 애드혹 SQL 에 쓸 3-part FQN 을 함께 반환한다. ' +
      'FQN 을 직접 조립하지 말 것 — bare 테이블명은 500, 2-part 는 400 이다.',
    inputSchema: {
      type: 'object',
      properties: { objectId: ID_SCHEMA },
      required: ['objectId'],
    },
    run: async (ref, args) => {
      const detail = await getObjectDetail(ref, requireId(args, 'objectId'))
      // FQN 조립을 여기서 끝낸다. 규칙(leaf = 객체 name, collectionName 아님)을 에이전트가
      // 매번 다시 알아내야 하면 틀린다 — 실제로 틀렸다.
      let fqn: string | null = null
      let fqnError: string | null = null
      try {
        fqn = buildFqn(detail)
      } catch (err) {
        fqnError = (err as Error).message
      }
      return { ...detail, fqn, fqnError }
    },
  },
  {
    name: 'list_object_records',
    description:
      '객체의 실제 레코드를 몇 건 본다. 스키마만 보면 값의 형태를 모른다 — 원본 컬럼은 대개 ' +
      '문자열로 온다 (예: "0.95").',
    inputSchema: {
      type: 'object',
      properties: {
        objectId: ID_SCHEMA,
        size: { type: 'integer', description: '가져올 건수 (기본 20)' },
      },
      required: ['objectId'],
    },
    run: (ref, args) =>
      listObjectRecords(
        ref,
        requireId(args, 'objectId'),
        typeof args.size === 'number' ? args.size : 20,
      ),
  },
  {
    name: 'query_sql',
    description:
      '읽기 전용 SparkSQL 실행. FROM 에는 get_object_detail 이 준 3-part FQN 을 쓴다. ' +
      'SELECT / WITH 만 허용된다. **펑션을 만들기 전에 이걸로 쿼리를 먼저 검증할 것** — ' +
      '펑션은 삭제 엔드포인트가 없어 잘못 만들면 영구히 남는다.',
    inputSchema: {
      type: 'object',
      properties: { sql: { type: 'string', description: 'SELECT 또는 WITH 로 시작하는 쿼리' } },
      required: ['sql'],
    },
    run: (ref, args) => querySql(ref, requireString(args, 'sql')),
  },
  {
    name: 'list_links',
    description: '객체 간 링크(관계) 목록. 조인이 가능한지 판단할 때 본다.',
    inputSchema: { type: 'object', properties: {} },
    run: (ref) => listLinks(ref),
  },
  {
    name: 'list_functions',
    description: '한 객체에 이미 만들어진 펑션 목록. 새로 만들기 전에 중복을 확인한다.',
    inputSchema: {
      type: 'object',
      properties: { ontologyObjectId: ID_SCHEMA },
      required: ['ontologyObjectId'],
    },
    run: (ref, args) => listFunctions(ref, requireId(args, 'ontologyObjectId')),
  },
  {
    name: 'run_function',
    description:
      '저장된 펑션을 실행한다. 생성된 앱이 런타임에 부르는 것과 같은 경로이므로, ' +
      '앱에 넣기 전 응답 형태를 이걸로 확인한다.',
    inputSchema: {
      type: 'object',
      properties: {
        functionId: ID_SCHEMA,
        parameters: { type: 'object', description: '펑션 파라미터 (없으면 {})' },
      },
      required: ['functionId'],
    },
    run: (ref, args) =>
      runFunction(
        ref,
        requireId(args, 'functionId'),
        (args.parameters as Record<string, unknown>) ?? {},
      ),
  },
  {
    name: 'list_actions',
    description:
      '온톨로지 액션 목록. 앱의 ACTIONS 상수에 박을 UUID 를 여기서 얻는다. ' +
      '액션 생성·실행은 이 도구에 없다 (제품 앱빌더에도 없다) — 사람이 UI 로 미리 만든다.',
    inputSchema: { type: 'object', properties: {} },
    run: (ref) => listActions(ref),
  },
  {
    name: 'list_action_runs',
    description: '액션 실행 이력. 앱이 액션을 부르고 실패했을 때 원인을 추적한다.',
    inputSchema: { type: 'object', properties: {} },
    run: (ref) => listActionRuns(ref),
  },
  {
    name: 'create_function',
    description:
      '재사용 펑션을 만든다. **이 도구의 유일한 영속 쓰기이며 삭제 엔드포인트가 없다.** ' +
      'query_sql 로 쿼리를 검증한 뒤에만 호출할 것. ' +
      'FROM 은 서버가 3-part FQN 으로 정규화하므로 bare 테이블명으로 써도 된다.',
    inputSchema: {
      type: 'object',
      properties: {
        ontologyObjectId: ID_SCHEMA,
        name: { type: 'string', description: '식별자 (영문 스네이크 케이스 권장)' },
        displayName: { type: 'string' },
        description: { type: 'string' },
        query: { type: 'string', description: 'SELECT 또는 WITH 로 시작' },
        parameters: {
          type: 'object',
          description: '`{이름: {type, description, required}}`. 파라미터가 없으면 {}',
        },
        joinObjectIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'JOIN 이 참조하는 추가 객체 id (문자열). FROM 화이트리스트에 포함된다',
        },
      },
      required: ['ontologyObjectId', 'name', 'displayName', 'description', 'query', 'parameters'],
    },
    run: (ref, args) =>
      createFunction(ref, {
        ontologyObjectId: requireId(args, 'ontologyObjectId'),
        name: requireString(args, 'name'),
        displayName: requireString(args, 'displayName'),
        description: requireString(args, 'description'),
        query: requireString(args, 'query'),
        parameters: (args.parameters as Record<string, never>) ?? {},
        ...(Array.isArray(args.joinObjectIds)
          ? { joinObjectIds: args.joinObjectIds.map(String) }
          : {}),
      }),
  },
]

// ── 앱 컨텍스트 ──────────────────────────────────────────────────────────────

function resolveRef(appDir: string): OntologyRef {
  const meta = readMeta(appDir)
  if (!meta.tenantId) {
    throw new Error(
      `앱 메타에 tenantId 가 없습니다 (${appDir}/.cos/appgen.json).\n` +
        '`appgen push --tenant <id>` 를 한 번 실행하거나 그 파일에 tenantId 를 넣어주세요.',
    )
  }
  return { tenantId: meta.tenantId, env: appEnv(appDir) }
}

// ── JSON-RPC 2.0 (stdio) ─────────────────────────────────────────────────────

function send(message: Json): void {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

function log(text: string): void {
  process.stderr.write(`[${SERVER_NAME}] ${text}\n`)
}

async function handleToolCall(appDir: string, params: Json): Promise<Json> {
  const name = typeof params.name === 'string' ? params.name : ''
  const tool = TOOLS.find((t) => t.name === name)
  if (!tool) throw new Error(`알 수 없는 툴: ${name}`)

  const args = (params.arguments as Json) ?? {}
  const result = await tool.run(resolveRef(appDir), args)
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  }
}

async function dispatch(appDir: string, method: string, params: Json): Promise<Json> {
  if (method === 'initialize') {
    const clientVersion = (params.protocolVersion as string) ?? FALLBACK_PROTOCOL_VERSION
    return {
      protocolVersion: clientVersion,
      capabilities: { tools: {} },
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    }
  }
  if (method === 'ping') return {}
  if (method === 'tools/list') {
    return {
      tools: TOOLS.map(({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema,
      })),
    }
  }
  if (method === 'tools/call') return await handleToolCall(appDir, params)

  const error = new Error(`지원하지 않는 메서드: ${method}`)
  ;(error as Error & { code?: number }).code = -32601
  throw error
}

async function handleMessage(appDir: string, line: string): Promise<void> {
  let message: Json
  try {
    message = JSON.parse(line) as Json
  } catch {
    log(`JSON 파싱 실패: ${line.slice(0, 120)}`)
    return
  }

  // id 가 없으면 notification 이다 — 응답을 보내면 프로토콜 위반이다.
  const id = message.id
  const isNotification = id === undefined || id === null
  const method = typeof message.method === 'string' ? message.method : ''
  const params = (message.params as Json) ?? {}

  if (isNotification) {
    if (method !== 'notifications/initialized') log(`무시한 notification: ${method}`)
    return
  }

  try {
    send({ jsonrpc: '2.0', id, result: await dispatch(appDir, method, params) })
  } catch (err) {
    const error = err as Error & { code?: number }
    // 툴 실패는 프로토콜 에러가 아니라 **툴 결과**로 돌려준다 — 에이전트가 메시지를 읽고
    // 스스로 고칠 수 있어야 한다. http.ts 가 traceId 와 ClickHouse 쿼리를 메시지에 실어준다.
    if (method === 'tools/call') {
      send({
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: error.message }], isError: true },
      })
      return
    }
    send({ jsonrpc: '2.0', id, error: { code: error.code ?? -32603, message: error.message } })
  }
}

function parseAppDir(argv: string[]): string {
  const at = argv.indexOf('--dir')
  return resolve(at === -1 ? process.cwd() : (argv[at + 1] ?? process.cwd()))
}

function main(): void {
  const appDir = parseAppDir(process.argv.slice(2))
  // 시작 시점에 앱 메타를 확인해 잘못된 디렉토리를 즉시 알린다 — 첫 툴 호출까지 미루면
  // 에이전트가 "툴이 안 된다" 로만 인식한다.
  try {
    readFileSync(`${appDir}/.cos/appgen.json`, 'utf8')
  } catch {
    log(`경고: 앱 디렉토리가 아닙니다 (${appDir}). 툴 호출이 전부 실패합니다.`)
  }
  log(`시작 (dir=${appDir}, 툴 ${TOOLS.length}개)`)

  let buffer = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk
    // 개행 구분 프레이밍. 마지막 조각은 다음 chunk 를 기다린다.
    let newline = buffer.indexOf('\n')
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (line) void handleMessage(appDir, line)
      newline = buffer.indexOf('\n')
    }
  })
  // `process.exit()` 를 부르지 않는다. stdin 이 끝나면 읽기 핸들이 사라지므로 진행 중인
  // 툴 호출이 끝난 뒤 이벤트 루프가 비어 Node 가 알아서 종료한다. 명시 exit 을 두면
  // **응답을 보내기 전에 in-flight HTTP 요청을 잘라먹는다** (실측: 이 테스트에서 응답 유실).
  process.stdin.on('end', () => log('stdin 종료 — 남은 호출을 마치고 종료합니다'))
}

main()
