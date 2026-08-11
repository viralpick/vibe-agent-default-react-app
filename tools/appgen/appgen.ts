#!/usr/bin/env node
/**
 * appgen — 로컬 Claude Code 로 AgentOS 앱을 만들고 제품에 핸드오프하는 도구.
 *
 * 사람이 쓰는 명령(bootstrap / login / token / open)은 여기, 에이전트가 쓰는 도구는
 * MCP 서버에 둔다. MCP 인 이유는 Claude Code 가 툴별로 allow/ask 를 걸 수 있고 툴 추가가
 * 정의 파일에 드러나기 때문이다 — CLI 서브커맨드는 암묵적으로 늘어난다.
 *
 * 환경은 dev 고정이며 오버라이드를 제공하지 않는다 (bootstrap.ts 의 DEV 참조).
 *
 * Node 가 .ts 를 네이티브로 실행한다 (타입 스트리핑). 레포 tsconfig 의
 * erasableSyntaxOnly 가 그 제약(enum / namespace / parameter property 금지)을 강제한다.
 */

import { execFileSync } from 'node:child_process'

import { bootstrap, DEV } from './bootstrap.ts'
import { buildFqn, getObjectDetail, listActions, listCollections, listFunctions, listLinks, querySql } from './ontology.ts'
import { formatRemaining, readToken, saveTokenFromClipboard, tokenStatus } from './token.ts'

/** 템플릿의 dev 스크립트가 `vite --port 3000` 이다. */
const DEV_PORT = 3000

const MODES = [
  'synapse',
  'free',
  'notion',
  'linear-app',
  'github',
  'vercel',
  'figma',
  'discord',
  'openai',
  'claude',
  'apple',
  'supabase',
  'shopify',
  'stripe',
  'airtable',
  'posthog',
  'sentry',
] as const

const USAGE = `appgen — AgentOS 로컬 앱 도구 (dev 전용)

사용법
  appgen bootstrap <이름> [--mode <모드>] [--dir <경로>]
      앱 작업 디렉토리를 만든다. 기본 위치는 <레포>/local-apps/<이름> (gitignore 대상), 기본 모드는 synapse.
      이 레포 안에서 앱을 만들지 말고 반드시 이 명령으로 사본을 만들 것.

  appgen modes
      사용 가능한 디자인 모드를 나열한다.

  appgen login [--clear]
      클립보드의 access token 을 검증해 저장한다. 브라우저 devtools 에서 복사한 뒤 실행한다.
      토큰 값은 명령줄에 나타나지 않는다. --clear 는 저장 후 클립보드를 비운다.

  appgen token
      저장된 토큰의 남은 시간을 확인한다. 토큰 값은 출력하지 않는다.

  appgen probe --tenant <id> [--object <id>]
      읽기 경로를 훑어 접근 가능 여부를 확인한다 (자기점검용).

  appgen open [--port <n>] [--path <경로>]
      로컬 dev 서버를 토큰과 함께 브라우저로 연다. 기본 포트 ${DEV_PORT}.
      토큰을 저장소에서 직접 읽어 URL 을 만들므로 토큰 값이 명령줄에 나타나지 않는다.

환경 (고정, 변경 불가)
  app-api      ${DEV.appApi}
  agent-app    ${DEV.agentApi}
  proxy-origin ${DEV.proxyOrigin}
`

interface ParsedArgs {
  flags: Record<string, string>
  positional: string[]
}

function parseFlags(argv: string[]): ParsedArgs {
  const flags: Record<string, string> = {}
  const positional: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) throw new Error(`--${key} 에 값이 필요합니다.`)
      flags[key] = next
      i++
    } else {
      positional.push(arg)
    }
  }
  return { flags, positional }
}

async function runBootstrap(rest: string[]): Promise<void> {
  const { flags, positional } = parseFlags(rest)
  const name = positional[0]
  if (!name) throw new Error('앱 이름이 필요합니다. 예: appgen bootstrap my-app')

  const mode = flags.mode ?? 'synapse'
  if (!MODES.includes(mode as (typeof MODES)[number])) {
    throw new Error(`알 수 없는 모드: ${mode}\n사용 가능: ${MODES.join(', ')}`)
  }

  const { dir, copied } = await bootstrap({ name, mode, targetDir: flags.dir })
  process.stdout.write(
    [
      `작업 디렉토리를 만들었습니다: ${dir}`,
      `  템플릿 파일 ${copied}개, 모드 ${mode}, git 초기 커밋 완료 (remote 없음)`,
      '',
      '다음 단계',
      `  cd ${dir}`,
      '  npm install',
      '  npm run dev',
      '',
      '앱에서 데이터를 쓰려면 브라우저 주소에 토큰을 붙인다:',
      '  http://localhost:3000/?token=<access token>  (appgen open 이 대신 열어준다)',
      '',
    ].join('\n'),
  )
}

/** 읽기 경로 자기점검. 각 호출의 성공/실패를 한 줄로 보고한다. */
async function runProbe(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest)
  const tenantId = flags.tenant
  if (!tenantId) throw new Error('--tenant <회사 id> 가 필요합니다.')
  const ref = { tenantId }

  const status = tokenStatus()
  process.stdout.write(`토큰: ${formatRemaining(status.remainingSeconds)}${status.email ? ` (${status.email})` : ''}\n\n`)

  const checks: [string, () => Promise<unknown>][] = [
    ['컬렉션 목록', () => listCollections(ref)],
    ['링크 목록', () => listLinks(ref)],
    ['액션 목록', () => listActions(ref)],
  ]

  if (flags.object) {
    const objectId = flags.object
    checks.push(['객체 상세', () => getObjectDetail(ref, objectId)])
    checks.push(['펑션 목록', () => listFunctions(ref, objectId)])
    checks.push([
      'SELECT 쿼리',
      async () => {
        const detail = await getObjectDetail(ref, objectId)
        const fqn = buildFqn(detail)
        const columns = Object.keys(detail.structure ?? {}).slice(0, 2)
        const select = columns.length > 0 ? columns.join(', ') : '*'
        const result = await querySql(ref, `SELECT ${select} FROM ${fqn} LIMIT 2`)
        return { fqn, columns: result.columns, rowCount: result.rows.length }
      },
    ])
  }

  let failed = 0
  for (const [label, run] of checks) {
    try {
      const result = await run()
      const hint = summarize(result)
      process.stdout.write(`  ✓ ${label.padEnd(12)} ${hint}\n`)
    } catch (err) {
      failed++
      process.stdout.write(`  ✗ ${label.padEnd(12)} ${(err as Error).message.split('\n')[0]}\n`)
    }
  }
  process.stdout.write(`\n실패 ${failed}건\n`)
  if (failed > 0) process.exitCode = 1
}

/**
 * dev 서버를 토큰과 함께 브라우저로 연다.
 *
 * URL 을 출력하지 않고 직접 여는 것이 요점이다. 출력하면 토큰이 터미널과(에이전트가
 * 실행했다면) 트랜스크립트에 남는다. 앱은 `?token=` 쿼리를 useUrlToken 훅으로 읽어
 * setStaticToken 에 넘긴다.
 *
 * static token 경로에는 갱신 로직이 없다 (401 인터셉터가 getTokenFn 만 본다). 만료되면
 * 이 명령을 다시 실행해 새 토큰으로 페이지를 열어야 한다.
 */
function openApp(rest: string[]): void {
  const { flags } = parseFlags(rest)
  const port = flags.port ?? String(DEV_PORT)
  const path = flags.path ?? '/'

  const url = new URL(path, `http://localhost:${port}`)
  url.searchParams.set('token', readToken())

  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open'
  execFileSync(opener, [url.toString()], { stdio: 'ignore' })

  const status = tokenStatus()
  process.stdout.write(
    `브라우저에서 열었습니다: http://localhost:${port}${path} (토큰 포함, 값은 출력하지 않음)\n` +
      `  ${formatRemaining(status.remainingSeconds)}\n`,
  )
}

function summarize(value: unknown): string {
  if (Array.isArray(value)) return `배열 ${value.length}개`
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>)
    const arrayKey = keys.find((k) => Array.isArray((value as Record<string, unknown>)[k]))
    if (arrayKey) {
      const arr = (value as Record<string, unknown>)[arrayKey] as unknown[]
      return `${arrayKey} ${arr.length}개`
    }
    return keys.slice(0, 5).join(', ')
  }
  return String(value)
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2)

  if (!command || command === 'help' || command === '--help') {
    process.stdout.write(USAGE)
    return
  }
  if (command === 'modes') {
    process.stdout.write(`${MODES.join('\n')}\n`)
    return
  }
  if (command === 'bootstrap') {
    await runBootstrap(rest)
    return
  }
  if (command === 'login') {
    const status = saveTokenFromClipboard({ clear: rest.includes('--clear') })
    process.stdout.write(
      `저장했습니다. ${formatRemaining(status.remainingSeconds)}` +
        `${status.email ? ` (${status.email})` : ''}\n  만료 ${status.expiresAt.toISOString()}\n`,
    )
    return
  }
  if (command === 'token') {
    const status = tokenStatus()
    process.stdout.write(
      `${formatRemaining(status.remainingSeconds)}${status.email ? ` (${status.email})` : ''}\n` +
        `  만료 ${status.expiresAt.toISOString()}\n`,
    )
    return
  }
  if (command === 'probe') {
    await runProbe(rest)
    return
  }
  if (command === 'open') {
    openApp(rest)
    return
  }
  throw new Error(`알 수 없는 명령: ${command}\n\n${USAGE}`)
}

try {
  await main()
} catch (err) {
  process.stderr.write(`오류: ${(err as Error).message}\n`)
  process.exitCode = 1
}
