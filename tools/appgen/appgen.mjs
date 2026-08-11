#!/usr/bin/env node
/**
 * appgen — 로컬 Claude Code 로 AgentOS 앱을 만들고 제품에 핸드오프하는 도구.
 *
 * 사람이 쓰는 명령(bootstrap / login / token / open)은 여기, 에이전트가 쓰는 도구는
 * MCP 서버(mcp_server.mjs)에 둔다. MCP 인 이유는 Claude Code 가 툴별로 allow/ask 를
 * 걸 수 있고 툴 추가가 정의 파일에 드러나기 때문이다 — CLI 서브커맨드는 암묵적으로 늘어난다.
 *
 * 환경은 dev 고정이며 오버라이드를 제공하지 않는다 (bootstrap.mjs 의 DEV 참조).
 */

import { bootstrap, DEV } from './bootstrap.mjs'

const USAGE = `appgen — AgentOS 로컬 앱 도구 (dev 전용)

사용법
  appgen bootstrap <이름> [--mode <모드>] [--dir <경로>]
      앱 작업 디렉토리를 만든다. 기본 위치는 ~/apps/<이름>, 기본 모드는 synapse.
      이 레포 안에서 앱을 만들지 말고 반드시 이 명령으로 사본을 만들 것.

  appgen modes
      사용 가능한 디자인 모드를 나열한다.

환경 (고정, 변경 불가)
  app-api      ${DEV.appApi}
  agent-app    ${DEV.agentApi}
  proxy-origin ${DEV.proxyOrigin}
`

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
]

function parseFlags(argv) {
  const flags = {}
  const positional = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) throw new Error(`--${key} 에 값이 필요합니다.`)
      flags[key] = next
      i++
    } else {
      positional.push(a)
    }
  }
  return { flags, positional }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2)

  if (!command || command === 'help' || command === '--help') {
    process.stdout.write(USAGE)
    return
  }

  if (command === 'modes') {
    process.stdout.write(MODES.join('\n') + '\n')
    return
  }

  if (command === 'bootstrap') {
    const { flags, positional } = parseFlags(rest)
    const name = positional[0]
    if (!name) throw new Error('앱 이름이 필요합니다. 예: appgen bootstrap my-app')
    const mode = flags.mode ?? 'synapse'
    if (!MODES.includes(mode)) {
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
        '  http://localhost:5173/?token=<access token>',
        '',
      ].join('\n')
    )
    return
  }

  throw new Error(`알 수 없는 명령: ${command}\n\n${USAGE}`)
}

try {
  await main()
} catch (err) {
  process.stderr.write(`오류: ${err.message}\n`)
  process.exitCode = 1
}
