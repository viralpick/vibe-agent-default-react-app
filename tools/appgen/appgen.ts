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
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { bootstrap } from './bootstrap.ts'
import {
  ENVIRONMENTS,
  metaPath,
  readMeta,
  resolveEnv,
  writeMeta,
  type EnvName,
  type Environment,
} from './env.ts'
import { AgentApiError } from './http.ts'
import {
  buildFqn,
  createChat,
  getObjectDetail,
  listActions,
  listAppBuilderModels,
  listCollections,
  listFunctions,
  listLinks,
  querySql,
} from './ontology.ts'
import { pullSnapshot, pushSnapshot, readBaseVersion } from './snapshot.ts'
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

const USAGE = `appgen — AgentOS 로컬 앱 도구

사용법
  appgen bootstrap <이름> [--mode <모드>] [--env <환경>] [--dir <경로>]
      앱 작업 디렉토리를 만든다. 기본 위치는 <레포>/local-apps/<이름> (gitignore 대상),
      기본 모드는 synapse, 기본 환경은 dev.
      이 레포 안에서 앱을 만들지 말고 반드시 이 명령으로 사본을 만들 것.

  appgen modes
      사용 가능한 디자인 모드를 나열한다.

  appgen login [--env <환경>] [--clear]
      클립보드의 access token 을 검증해 저장한다. 브라우저 devtools 에서 복사한 뒤 실행한다.
      토큰 값은 명령줄에 나타나지 않는다. --clear 는 저장 후 클립보드를 비운다.
      토큰은 환경별로 따로 저장되므로 dev 와 local 을 번갈아 써도 서로 덮어쓰지 않는다.

  appgen token [--env <환경>]
      저장된 토큰의 남은 시간을 확인한다. 토큰 값은 출력하지 않는다.

  appgen probe --tenant <id> [--object <id>] [--env <환경>]
      읽기 경로를 훑어 접근 가능 여부를 확인한다 (자기점검용).

  appgen open [--port <n>] [--path <경로>]
      로컬 dev 서버를 토큰과 함께 브라우저로 연다.
      포트는 ${DEV_PORT} 부터 훑어 vite 가 실제로 뜬 곳을 찾는다 — 로컬 FE 가 ${DEV_PORT} 을 쓰면
      vite 가 ${DEV_PORT + 1} 로 올라가는데, 고정 포트로 열면 토큰이 FE 로 간다.
      \`<title>\` 로 이 앱의 서버인지 확인해 알려준다. 아니어도 막지 않고 무엇을 열었는지 밝힌다.
      토큰을 저장소에서 직접 읽어 URL 을 만들므로 토큰 값이 명령줄에 나타나지 않는다.

  appgen servers [--stop]
      떠 있는 dev 서버를 앱 이름과 함께 보여준다. \`--stop\` 이면 모두 끈다.
      \`npm run dev\` **앞에** 확인한다 — 떠 있으면 새로 띄우지 않고 그대로 쓴다. 잊고 또
      띄우면 vite 가 다음 포트로 올라가 같은 앱의 서버가 둘이 된다.
      작업을 마칠 때(push·배포 후) 정리한다.

  appgen chat create --tenant <id> [--model <code>] [--name "<이름>"] [--dir <경로>]
      빈 앱빌더 챗을 만들고 앱 메타에 연결한다. **최초 1회만** 필요하다.
      제품 UI 로 만들면 프롬프트를 보내야 해서 에이전트 생성 한 턴이 함께 돈다 (LLM 비용 +
      샌드박스 기동 + 곧 덮어쓸 스냅샷). 우리는 빈 챗만 필요하므로 직접 만든다.
      모델은 앱빌더에 노출되는 것 중에서 고른다 (미지정 시 기본 모델).
      챗 소유자는 로그인한 계정이 된다 — 고객에게 넘길 앱이면 고객이 만들어야 한다.

  appgen push --prompt "<한 줄>" [--chat <id>] [--tenant <id>] [--title "<제목>"]
              [--requirements '<JSON 배열>'] [--plan '<JSON 배열>'] [--dir <경로>]
      현재 코드를 제품 스냅샷으로 승격한다. 로컬 반복은 스냅샷을 만들지 않으므로
      "이제 제품에서 보이게 하겠다" 는 시점에만 실행한다.
      --chat / --tenant 는 첫 실행에만 필요하다 (앱 메타에 기록됨).
      --requirements 예: '[{"name":"매출 추이 차트","description":"월별 트렌드"}]'
      --plan 은 제품 챗의 Checkpoint 본문에 표시되는 작업 단계다. 안 보내면 그 영역이 빈다.
             예: '[{"title":"코드 수정","description":"App.tsx 에 검색 카드 추가"}]'

  appgen pull [--version <n>] [--chat <id>] [--tenant <id>] [--dir <경로>]
      제품 스냅샷을 워킹트리로 가져온다. 덮어쓰기 전 상태를 커밋으로 남기므로
      되돌리려면 그 커밋을 restore 하면 된다. --version 미지정이면 최신.

  appgen status [--dir <경로>]
      앱의 환경·연결된 chat·기준 버전을 확인한다.

환경 (앱마다 bootstrap 시점에 고정된다. 전역 기본값 없음)
${Object.values(ENVIRONMENTS)
  .map((e) => `  ${e.name.padEnd(6)} app-api ${e.appApi}\n         agent-app ${e.agentApi}`)
  .join('\n')}
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

  const { dir, copied, env } = await bootstrap({ name, mode, env: flags.env, targetDir: flags.dir })
  process.stdout.write(
    [
      `작업 디렉토리를 만들었습니다: ${dir}`,
      `  템플릿 파일 ${copied}개, 모드 ${mode}, 환경 ${env.name}, git 초기 커밋 완료 (remote 없음)`,
      `  app-api ${env.appApi}`,
      '',
      '다음 단계',
      `  cd ${dir}`,
      '  npm install',
      '  npm run dev',
      '',
      '앱에서 데이터를 쓰려면 브라우저 주소에 토큰을 붙인다:',
      `  http://localhost:${DEV_PORT}/?token=<access token>  (appgen open 이 대신 열어준다)`,
      '',
    ].join('\n'),
  )
}

/** 읽기 경로 자기점검. 각 호출의 성공/실패를 한 줄로 보고한다. */
async function runProbe(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest)
  const tenantId = flags.tenant
  if (!tenantId) throw new Error('--tenant <회사 id> 가 필요합니다.')
  const env = envForCwd(flags)
  const ref = { tenantId, env }

  const status = tokenStatus(env.name)
  process.stdout.write(
    `환경 ${env.name} / 토큰: ${formatRemaining(status.remainingSeconds)}${status.email ? ` (${status.email})` : ''}\n\n`,
  )

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
 * vite dev 서버가 실제로 뜬 포트를 찾는다.
 *
 * **왜 필요한가**: 템플릿의 dev 스크립트는 `vite --port 3000` 인데 로컬 FE
 * (commerceos-application)도 3000 을 쓴다. 점유되어 있으면 vite 가 조용히 3001, 3002 …
 * 로 올라간다. 고정 포트로 열면 **FE 를 열게 되고, URL 에 붙는 `?token=` 이 FE origin 으로
 * 간다** — 앱이 아닌 곳의 브라우저 히스토리와 서버 로그에 토큰이 남는다. 동작 오류보다
 * 이쪽이 문제다.
 *
 * vite 인지 아닌지는 `/@vite/client` 로 판별한다. vite dev 서버가 항상 주입하는 스크립트이고
 * Next.js FE 에는 없다 (실측).
 *
 * **그런데 "vite 다" 만으로는 부족하다.** `local-apps/` 에는 앱이 여러 개 있고 전부 vite 다.
 * 다른 앱의 서버가 3000 을 잡고 내 서버가 3001 로 밀리면, 3000 부터 훑는 탐색이 **다른 앱을
 * 내 토큰과 함께 연다.** 게다가 그때 포트가 기본값이라 "포트가 옮겨갔다" 는 안내조차 안 나가서
 * 조용히 엉뚱한 앱을 본다 (실제로 앱 3개가 같은 템플릿 `<title>` 을 쓰고 있었다).
 *
 * 그래서 `<title>` 로 어느 앱인지까지 확인한다. 예전 주석은 "title 은 앱이 바꿀 수 있어 쓰지
 * 않는다" 였는데, 이제 bootstrap 이 title 을 앱 이름으로 박으므로 **우리가 정하는 표식**이다.
 *
 * **탐색 요청에는 토큰을 싣지 않는다.** 확인된 포트에만 토큰 URL 을 준다.
 */
const PORT_SCAN_COUNT = 10

interface DevServer {
  port: number
  /** index.html 의 `<title>`. bootstrap 이 앱 이름을 박는다. 없으면 null. */
  title: string | null
}

async function scanDevServers(startPort: number): Promise<DevServer[]> {
  const found: DevServer[] = []
  for (let port = startPort; port < startPort + PORT_SCAN_COUNT; port++) {
    try {
      const response = await fetch(`http://localhost:${port}/`, {
        signal: AbortSignal.timeout(1500),
      })
      if (!response.ok) continue
      const html = await response.text()
      if (!html.includes('/@vite/client')) continue
      found.push({ port, title: html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? null })
    } catch {
      // 닫힌 포트거나 타임아웃 — 다음 후보로.
    }
  }
  return found
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
async function openApp(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest)
  const path = flags.path ?? '/'
  const env = envForCwd(flags)

  // 앱 디렉토리 밖에서도 동작해야 하므로 (토큰만 있으면 열 수 있다) 이름은 있으면 쓴다.
  const appDir = resolve(flags.dir ?? process.cwd())
  const appName = existsSync(metaPath(appDir)) ? readMeta(appDir).name : null

  // --port 를 명시했으면 그대로 믿는다. 탐색은 기본값일 때만 한다.
  let port: number
  let note = ''
  if (flags.port !== undefined) {
    port = Number.parseInt(flags.port, 10)
    if (!Number.isInteger(port)) throw new Error(`--port 가 정수가 아닙니다: ${flags.port}`)
  } else {
    const servers = await scanDevServers(DEV_PORT)
    if (servers.length === 0) {
      throw new Error(
        `vite dev 서버를 찾지 못했습니다 (${DEV_PORT}~${DEV_PORT + PORT_SCAN_COUNT - 1} 확인).\n` +
          '앱 디렉토리에서 `npm run dev` 를 먼저 띄우거나 --port 로 지정하세요.',
      )
    }

    if (appName === null) {
      // 앱 디렉토리가 아니면 어느 앱인지 확인할 방법이 없다. 추측한 사실을 밝힌다.
      port = servers[0].port
      note = `  (앱 디렉토리가 아니어서 어느 앱인지 확인하지 못했습니다: "${servers[0].title ?? '제목 없음'}")\n`
    } else {
      const mine = servers.filter((s) => s.title === appName)

      // **막지 않고 알려준다.** 앱을 여러 개 동시에 붙드는 일은 거의 없고, 이 명령은 디버깅
      // 용도라 다른 앱이 열려도 치명적이지 않다. 그래서 못 찾으면 거부하는 대신 무엇을
      // 열었는지 밝히고 진행한다. (초기 구현은 거부였는데 실제 쓰임에 비해 과했다.)
      if (mine.length === 0) {
        const picked = servers[0]
        port = picked.port
        note =
          `  ⚠️ 이 앱(${appName})의 서버가 아닙니다. 포트 ${picked.port} 의 "${picked.title ?? '제목 없음'}" 을 열었습니다.\n` +
          '     의도한 앱이 아니면 이 디렉토리에서 `npm run dev` 를 띄우거나 --port 로 지정하세요.\n'
      } else {
        port = mine[0].port
        if (mine.length > 1) {
          // 이전 작업에서 띄운 서버가 살아 있는 채로 하나 더 띄우면 같은 앱을 서빙하는 서버가
          // 둘이 되고, 어느 쪽을 보는지 알 수 없다. `appgen servers --stop` 으로 정리한다.
          note =
            `  ⚠️ 이 앱을 서빙하는 서버가 ${mine.length}개입니다 (포트 ${mine.map((s) => s.port).join(', ')}).\n` +
            `     ${mine[0].port} 을 열었습니다. \`appgen servers --stop\` 으로 정리할 수 있습니다.\n`
        } else if (port !== DEV_PORT) {
          note = `  (${DEV_PORT} 이 점유되어 vite 가 ${port} 로 올라갔습니다)\n`
        }
      }
    }
  }

  const url = new URL(path, `http://localhost:${port}`)
  url.searchParams.set('token', readToken(env.name))

  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open'
  execFileSync(opener, [url.toString()], { stdio: 'ignore' })

  const status = tokenStatus(env.name)
  process.stdout.write(
    `브라우저에서 열었습니다: http://localhost:${port}${path} (토큰 포함, 값은 출력하지 않음)\n` +
      note +
      `  ${formatRemaining(status.remainingSeconds)}\n`,
  )
}

/**
 * 떠 있는 dev 서버를 보여주고, `--stop` 이면 정리한다.
 *
 * ## 왜 명령으로 두는가
 *
 * 실제로 낸 사고가 이것이다. 이전 작업에서 띄운 서버를 잊고 `npm run dev` 를 또 실행했고,
 * vite 가 조용히 다음 포트로 올라가 **같은 앱을 서빙하는 서버가 둘**이 됐다. 어느 쪽을 보고
 * 있는지 알 수 없는 상태가 된다.
 *
 * "확인하는 습관" 으로 막으려 했지만 잊는 것이 문제의 본질이라 한 줄로 만들었다. 쓰는 시점은
 * 둘이다. `npm run dev` **앞**(떠 있으면 새로 띄우지 않고 그대로 쓴다), 그리고 작업을 **마칠
 * 때**(push 나 배포 후, 또는 그만하자고 할 때 물어보고 정리).
 *
 * `--stop` 은 훑어서 찾은 vite dev 서버를 모두 끈다. 로컬 FE 는 Next.js 라 `/@vite/client` 가
 * 없어서 애초에 목록에 잡히지 않는다 — 끄고 싶지 않은 것이 걸릴 위험이 구조적으로 낮다.
 */
async function runServers(rest: string[]): Promise<void> {
  const stop = rest.includes('--stop')
  const appDir = resolve(process.cwd())
  const appName = existsSync(metaPath(appDir)) ? readMeta(appDir).name : null

  const servers = await scanDevServers(DEV_PORT)
  if (servers.length === 0) {
    process.stdout.write(
      `떠 있는 dev 서버가 없습니다 (${DEV_PORT}~${DEV_PORT + PORT_SCAN_COUNT - 1} 확인).\n`,
    )
    return
  }

  process.stdout.write(
    `${servers
      .map(
        (s) =>
          `  포트 ${s.port}: ${s.title ?? '(제목 없음)'}` +
          (appName !== null && s.title === appName ? '  <- 이 앱' : ''),
      )
      .join('\n')}\n`,
  )

  if (!stop) {
    process.stdout.write('그대로 쓰면 됩니다. 정리는 `appgen servers --stop`.\n')
    return
  }

  for (const server of servers) {
    const pids = listeningPids(server.port)
    if (pids.length === 0) {
      process.stdout.write(`  포트 ${server.port}: 프로세스를 찾지 못해 건너뜁니다.\n`)
      continue
    }
    for (const pid of pids) process.kill(pid, 'SIGTERM')
    process.stdout.write(`  포트 ${server.port} 정리 (pid ${pids.join(', ')})\n`)
  }
}

/** 그 포트를 LISTEN 하는 pid. lsof 가 없거나 실패하면 빈 배열 (정리를 건너뛴다). */
function listeningPids(port: number): number[] {
  try {
    const out = execFileSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' })
    return out
      .split('\n')
      .map((line) => Number.parseInt(line.trim(), 10))
      .filter((pid) => Number.isInteger(pid))
  } catch {
    return []
  }
}

/**
 * `--env <이름>` 만 뽑는다. `login` 은 값 없는 `--clear` 를 함께 받아 parseFlags 를 못 쓴다
 * (그 함수는 모든 `--x` 에 값이 오는 것을 전제한다).
 */
function envNameFromArgv(argv: string[]): EnvName {
  const at = argv.indexOf('--env')
  if (at === -1) return resolveEnv(undefined).name
  return resolveEnv(argv[at + 1]).name
}

/** 앱 작업 디렉토리. `--dir` 이 없으면 cwd. 앱 디렉토리가 아니면 멈춘다. */
function appDirOf(flags: Record<string, string>): string {
  const dir = resolve(flags.dir ?? process.cwd())
  if (!existsSync(metaPath(dir))) {
    throw new Error(
      `앱 작업 디렉토리가 아닙니다: ${dir}\n` +
        '앱 디렉토리에서 실행하거나 --dir <경로> 로 지정하세요.',
    )
  }
  return dir
}

/**
 * 앱 안에서도 밖에서도 쓰는 명령(login/token/open/probe)의 대상 환경.
 *
 * 우선순위는 명시 `--env` → 앱 메타 → dev 다. 앱 안에서 실행했으면 그 앱의 환경을 쓰는 것이
 * 놀랍지 않고, `--env` 로 언제든 덮을 수 있다.
 */
function envForCwd(flags: Record<string, string>): Environment {
  if (flags.env) return resolveEnv(flags.env)
  const dir = resolve(flags.dir ?? process.cwd())
  if (existsSync(metaPath(dir))) return resolveEnv(readMeta(dir).env)
  return resolveEnv(undefined)
}

/** `[{a, description}, ...]` 플래그를 파싱한다. 서버도 같은 형태를 검증하지만 왕복 전에 잡는다. */
function parseItems<K extends string>(
  raw: string | undefined,
  flag: string,
  key: K,
): Array<Record<K | 'description', string>> | undefined {
  if (raw === undefined) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(`--${flag} 가 JSON 이 아닙니다: ${(err as Error).message}`)
  }
  if (!Array.isArray(parsed)) throw new Error(`--${flag} 는 JSON 배열이어야 합니다.`)
  return parsed.map((item, i) => {
    const obj = item as Record<string, unknown>
    if (typeof obj?.[key] !== 'string' || typeof obj?.description !== 'string') {
      throw new Error(`--${flag}[${i}] 는 {${key}, description} 이어야 합니다.`)
    }
    return { [key]: obj[key], description: obj.description } as Record<K | 'description', string>
  })
}

/**
 * 빈 앱빌더 챗을 만들고 앱 메타에 연결한다.
 *
 * 제품 UI 로 만들면 프롬프트를 보내야 하므로 **에이전트 생성 한 턴이 함께 돈다** (LLM 비용,
 * 샌드박스 기동, 곧 덮어쓸 v1 스냅샷). 우리는 빈 챗만 필요하다.
 *
 * 모델은 `appBuilderGroup !== 'NONE'` 중에서 고른다. 아무 코드나 넣으면 이후 제품 챗에서
 * 수정할 때 에이전트가 첫 단계에서 죽는다 (실측 — FE 는 "배포에 실패했습니다" 만 보여준다).
 */
async function runChatCreate(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest)
  const appDir = appDirOf(flags)
  const meta = readMeta(appDir)
  const env = resolveEnv(meta.env)

  const tenantId = flags.tenant ?? meta.tenantId
  if (!tenantId) throw new Error('--tenant <회사 id> 가 필요합니다 (앱 메타에 없습니다).')
  if (meta.chatId && flags.force === undefined) {
    throw new Error(
      `이미 chat ${meta.chatId} 에 연결돼 있습니다. 새로 만들려면 --force true 를 주세요.`,
    )
  }

  const ref = { tenantId, env }
  const models = await listAppBuilderModels(ref)
  if (models.length === 0) {
    throw new Error('앱빌더에 쓸 수 있는 모델이 없습니다 (appBuilderGroup 이 전부 NONE).')
  }

  const model = flags.model
    ? models.find((m) => m.code === flags.model)
    : (models.find((m) => m.isDefault) ??
      models.find((m) => m.appBuilderGroup === 'QUALITY') ??
      models[0])
  if (!model) {
    throw new Error(
      `모델 ${flags.model} 은 앱빌더에 쓸 수 없습니다.\n사용 가능:\n` +
        models.map((m) => `  ${m.code}  (${m.appBuilderGroup}, ${m.provider})`).join('\n'),
    )
  }

  const chat = await createChat(ref, {
    name: flags.name ?? meta.name,
    model: model.code,
    // 로컬 프리셋과 일치시킨다 — 어긋나면 제품 첫 수정에서 디자인이 덮어써진다.
    designMode: meta.mode,
  })

  writeMeta(appDir, { ...meta, chatId: chat.id, tenantId })
  process.stdout.write(
    [
      `chat 을 만들었습니다: ${chat.id}`,
      `  모델 ${model.code} (${model.appBuilderGroup}), 디자인 ${meta.mode}, 환경 ${env.name}`,
      `  앱 메타에 기록했습니다 — 이후 push/pull 에 --chat 이 필요 없습니다`,
      '',
      '참고: 이 챗의 소유자는 방금 로그인한 계정입니다.',
      '      고객에게 넘길 앱이면 고객이 직접 만들고 chat id 를 받아야 합니다.',
      '',
    ].join('\n'),
  )
}

async function runPush(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest)
  const prompt = flags.prompt
  if (!prompt) throw new Error('--prompt "<이번 push 가 무엇을 했는지 한 줄>" 이 필요합니다.')

  const appDir = appDirOf(flags)
  try {
    const result = await pushSnapshot({
      appDir,
      prompt,
      chatId: flags.chat,
      tenantId: flags.tenant,
      title: flags.title,
      requirements: parseItems(flags.requirements, 'requirements', 'name'),
      plan: parseItems(flags.plan, 'plan', 'title'),
    })
    const lines = [
      `push 완료: v${result.version} (${result.env.name})`,
      `  ${result.s3_key}`,
      `  HISTORY #${result.history_entry_number} "${result.view_name}", 요구사항 ${result.requirements_count}건`,
    ]
    if (result.preCommitted) lines.push('  (커밋되지 않은 변경이 있어 push 전에 커밋했습니다)')
    for (const warning of [...result.localWarnings, ...result.warnings]) lines.push(`  ⚠ ${warning}`)
    lines.push('', `다음: 제품 UI 의 챗 ${result.chatId} 에서 배포 버튼을 누릅니다.`, '')
    process.stdout.write(lines.join('\n'))
  } catch (err) {
    // 갈라짐은 사용자가 할 일이 정해져 있으므로 그것만 알려준다.
    if (err instanceof AgentApiError && err.divergedTo !== null) {
      throw new Error(
        `제품 쪽이 v${err.divergedTo} 로 앞서 있어 push 를 거부했습니다.\n` +
          '  `appgen pull` 로 최신을 가져온 뒤 다시 push 하세요 (git 의 non-fast-forward 거부와 같습니다).',
      )
    }
    throw err
  }
}

async function runPull(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest)
  const appDir = appDirOf(flags)
  const version = flags.version === undefined ? undefined : Number.parseInt(flags.version, 10)
  if (version !== undefined && !Number.isInteger(version)) {
    throw new Error(`--version 이 정수가 아닙니다: ${flags.version}`)
  }

  const result = await pullSnapshot({
    appDir,
    chatId: flags.chat,
    tenantId: flags.tenant,
    version,
  })
  const lines = [
    `pull 완료: v${result.version} (${result.env.name}${result.publishStatus ? `, ${result.publishStatus}` : ''})`,
    result.committed
      ? `  ${(result.bytes / 1024).toFixed(0)}KB 전개, 커밋 "pull: product v${result.version}"`
      : `  ${(result.bytes / 1024).toFixed(0)}KB 전개, 변경 없음 (로컬과 바이트 단위로 동일)`,
  ]
  if (result.preCommitted) lines.push('  (커밋되지 않은 변경이 있어 전개 전에 커밋했습니다 — 되돌리려면 그 커밋을 restore)')
  if (result.version === 0) {
    lines.push('  참고: version 0 은 스냅샷 row 없이 객체만 있는 레거시 챗입니다. 다음 push 가 v1 을 만듭니다.')
  }
  lines.push('', '의존성이 바뀌었을 수 있습니다: npm install', '')
  process.stdout.write(lines.join('\n'))
}

function runStatus(rest: string[]): void {
  const { flags } = parseFlags(rest)
  const appDir = appDirOf(flags)
  const meta = readMeta(appDir)
  const env = resolveEnv(meta.env)

  const lines = [
    `앱 ${meta.name} (${appDir})`,
    `  환경      ${env.name}  app-api ${env.appApi}  agent-app ${env.agentApi}`,
    `  디자인    ${meta.mode}`,
    `  chat      ${meta.chatId ?? '미연결 (push 시 --chat 필요)'}`,
    `  테넌트    ${meta.tenantId ?? '미기록 (push 시 --tenant 필요)'}`,
  ]
  if (meta.chatId) lines.push(`  기준 버전 v${readBaseVersion(meta.chatId)}`)
  try {
    const status = tokenStatus(env.name)
    lines.push(`  토큰      ${formatRemaining(status.remainingSeconds)}${status.email ? ` (${status.email})` : ''}`)
  } catch (err) {
    lines.push(`  토큰      ${(err as Error).message.split('\n')[0]}`)
  }
  process.stdout.write(`${lines.join('\n')}\n`)
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
    // --clear 는 값 없는 플래그라 parseFlags 를 쓸 수 없다 (그 함수는 모든 --x 에 값을 요구).
    const envName = envNameFromArgv(rest)
    const status = saveTokenFromClipboard(envName, { clear: rest.includes('--clear') })
    process.stdout.write(
      `${envName} 토큰을 저장했습니다. ${formatRemaining(status.remainingSeconds)}` +
        `${status.email ? ` (${status.email})` : ''}\n  만료 ${status.expiresAt.toISOString()}\n`,
    )
    return
  }
  if (command === 'token') {
    const env = envForCwd(parseFlags(rest).flags)
    const status = tokenStatus(env.name)
    process.stdout.write(
      `${env.name}: ${formatRemaining(status.remainingSeconds)}${status.email ? ` (${status.email})` : ''}\n` +
        `  만료 ${status.expiresAt.toISOString()}\n`,
    )
    return
  }
  if (command === 'probe') {
    await runProbe(rest)
    return
  }
  if (command === 'open') {
    await openApp(rest)
    return
  }
  if (command === 'servers') {
    await runServers(rest)
    return
  }
  if (command === 'chat') {
    if (rest[0] !== 'create') throw new Error("`appgen chat create` 만 지원합니다.")
    await runChatCreate(rest.slice(1))
    return
  }
  if (command === 'push') {
    await runPush(rest)
    return
  }
  if (command === 'pull') {
    await runPull(rest)
    return
  }
  if (command === 'status') {
    runStatus(rest)
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
