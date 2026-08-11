/**
 * 앱 작업 디렉토리를 만든다.
 *
 * 작업 디렉토리는 템플릿 파일의 **사본**이다. 템플릿 자체를 편집하면 안 된다 — 제품의
 * restore_code_agent 가 스냅샷 없는 신규 앱 샌드박스를 이 레포 main 으로 `git reset --hard`
 * 하므로 오염이 전 신규 앱에 번진다.
 *
 * 사본의 기본 위치는 레포 안의 `local-apps/` 이지만 `.gitignore` 대상이라 tracked 내용이
 * 아니다 (`git ls-files` 에 안 잡히고 커밋되지 않는다). 홈 디렉토리에 앱이 쌓이지 않는다.
 *
 * 구조는 샌드박스의 /app/view-gen 과 동일해야 한다. push 가 만드는 tar 의 아카이브 루트가
 * 프로젝트 루트이고, 제품이 그 tar 를 그대로 풀기 때문이다.
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { resolveEnv, writeMeta, type Environment } from './env.ts'
import { resolvePreset } from './presets.ts'

const TOOL_DIR = dirname(fileURLToPath(import.meta.url))
const TEMPLATE_ROOT = resolve(TOOL_DIR, '../..')

/**
 * 작업 디렉토리로 복사하지 않는 경로.
 *
 * `tools/` — 이 도구 자신. 복사되면 push tar 에 실려 제품으로 넘어간다.
 * `local-apps/` — 앱 작업 디렉토리들. gitignore 대상이라 `git ls-files` 에 잡히지 않지만
 *   방어적으로 남긴다 (누군가 gitignore 를 손대도 사본이 재귀하지 않게).
 */
const EXCLUDED_PREFIXES = ['tools/', 'local-apps/']

/**
 * 앱 작업 디렉토리의 기본 부모.
 *
 * 템플릿 레포 안이지만 `.gitignore` 에 `local-apps/` 가 있어 tracked 내용이 아니다. 따라서
 * `templateFiles()` 의 `git ls-files` 에 잡히지 않고 템플릿 오염과 무관하다. 홈 디렉토리에
 * 앱이 쌓이지 않고 레포 하나만 지우면 정리된다는 이점이 있다.
 *
 * 주의: 여기서 앱을 만드는 것과 **템플릿 파일을 직접 편집하는 것**은 다르다. 후자는 여전히
 * 금지다 — 제품이 스냅샷 없는 신규 앱 샌드박스를 이 레포 main 으로 `git reset --hard` 한다.
 */
const DEFAULT_APPS_DIR = join(TEMPLATE_ROOT, 'local-apps')

export interface BootstrapOptions {
  /** 앱 이름 (작업 디렉토리 이름). */
  name: string
  /** 디자인 모드. 기본 synapse. */
  mode?: string
  /**
   * 대상 환경. 기본 dev.
   *
   * **여기서 정한 값이 앱에 박히고 이후 모든 명령이 그것만 쓴다** (`.cos/appgen.json`).
   * 전역 기본 환경을 두지 않는 이유는 `env.ts` 참조.
   */
  env?: string
  /** 작업 디렉토리 경로. 기본 `<레포>/local-apps/<name>` (gitignore 대상). */
  targetDir?: string
  proxyOrigin?: string
  designResourcesDir?: string
}

export interface BootstrapResult {
  dir: string
  mode: string
  env: Environment
  /** 템플릿에서 복사한 파일 수. */
  copied: number
}

/**
 * 템플릿의 tracked 파일 목록을 반환한다.
 *
 * `git ls-files` 를 쓰는 이유: 로컬 untracked 산물(agenthub-appbuilder/, .taskmaster/,
 * trace_reports/ 등)을 자동으로 배제하고, 제품 샌드박스가 받는 main 내용과 정확히 일치하는
 * 집합을 얻는다. 수동 exclude 목록은 템플릿이 변하면 낡는다.
 */
function templateFiles(): string[] {
  const out = execFileSync('git', ['-C', TEMPLATE_ROOT, 'ls-files', '-z'], { encoding: 'utf8' })
  return out
    .split('\0')
    .filter(Boolean)
    .filter((p) => !EXCLUDED_PREFIXES.some((prefix) => p.startsWith(prefix)))
}

async function copyTemplate(targetDir: string): Promise<number> {
  const files = templateFiles()
  for (const rel of files) {
    const dest = join(targetDir, rel)
    await mkdir(dirname(dest), { recursive: true })
    await cp(join(TEMPLATE_ROOT, rel), dest)
  }
  return files.length
}

/**
 * PostToolUse 자동커밋 훅 + 토큰 저장소 읽기 차단.
 *
 * 훅을 **작업 디렉토리**에 두는 것이 중요하다. 템플릿 레포나 hubone-backend 쪽에 두면
 * 그 레포 작업까지 자동 커밋된다.
 *
 * 커밋을 매 수정마다 찍어도 되는 이유는 git 이 내용 주소 저장 + delta 압축이기 때문이다
 * (501커밋 실측 2.5MB). 전체 복사 방식이면 감당할 수 없는 빈도다.
 */
const CLAUDE_SETTINGS = {
  hooks: {
    PostToolUse: [
      {
        matcher: 'Edit|Write',
        hooks: [
          {
            type: 'command',
            command:
              'git add -A >/dev/null 2>&1 && ' +
              'git -c user.name="AOS AppGen" -c user.email="appgen@local" ' +
              'commit -q -m "edit: ${FILE_PATH}" >/dev/null 2>&1 || true',
          },
        ],
      },
    ],
  },
  permissions: {
    deny: ['Read(~/.aos-appgen/**)', 'Read(./.env)', 'Read(./.env.*)'],
  },
}

export async function bootstrap({
  name,
  mode = 'synapse',
  env: envName,
  targetDir,
  proxyOrigin,
  designResourcesDir,
}: BootstrapOptions): Promise<BootstrapResult> {
  if (!name || !/^[a-z0-9][a-z0-9._-]*$/i.test(name)) {
    throw new Error(`앱 이름이 올바르지 않습니다: ${name} (영숫자로 시작, 영숫자/.-_ 만)`)
  }
  const env = resolveEnv(envName)
  const resolvedProxyOrigin = proxyOrigin ?? env.proxyOrigin
  const dir = targetDir ? resolve(targetDir) : join(DEFAULT_APPS_DIR, name)
  if (existsSync(dir)) throw new Error(`이미 존재합니다: ${dir}`)

  // 프리셋을 먼저 해석한다 — 실패하면 디렉토리를 만들기 전에 멈춘다.
  const preset = await resolvePreset({
    mode,
    proxyOrigin: resolvedProxyOrigin,
    ...(designResourcesDir ? { designResourcesDir } : {}),
  })

  await mkdir(dir, { recursive: true })
  const copied = await copyTemplate(dir)

  // .cos/ — 제품이 sandbox 에 주입하는 것과 같은 3개 파일.
  await mkdir(join(dir, '.cos'), { recursive: true })
  const guide = await readFile(join(TOOL_DIR, 'vendor/GUIDE.md'), 'utf8')
  await writeFile(join(dir, '.cos/GUIDE.md'), guide, 'utf8')
  await writeFile(join(dir, '.cos/DESIGN.md'), preset.designMd, 'utf8')
  // 빈 파일로 시작한다. 항목은 push 가 append 하며 번호/날짜는 코드가 부여한다
  // (LLM 자유 편집이 번호를 꼬는 것이 제품에서 관측된 문제).
  await writeFile(join(dir, '.cos/HISTORY.md'), '', 'utf8')

  // CLAUDE.md = 오버레이 + GUIDE 원문.
  //
  // GUIDE 를 그대로 쓰지 않는 이유: 그 문서는 제품 에이전트(샌드박스 파일 툴만 있고 런타임
  // 검증도 브라우저도 없으며 App.tsx 한 파일에만 쓰는)를 위해 쓰였다. 계약과 하네스 처방이
  // 섞여 있어서, 문자 그대로 따르면 제품의 천장을 그대로 물려받는다.
  //
  // 오버레이가 무효화 목록(§0 탐색 절차, §5.1 단일 파일, §4.1 스켈레톤)과 구속력 있는 계약을
  // 구분하고, Claude Code 가 추가로 할 일(런타임 검증, 구조화)을 선언한다. 원문은 포크하지 않고
  // vendor/ 에 그대로 두므로 상류 갱신 시 원문만 교체하면 된다.
  const overlay = await readFile(join(TOOL_DIR, 'overlay.md'), 'utf8')
  await writeFile(join(dir, 'CLAUDE.md'), `${overlay}\n${guide}`, 'utf8')

  // 디자인 모드 원문. 제품도 FE 가 보낸 tokens_css 로 이 파일을 교체한다.
  await writeFile(join(dir, 'src/theme.css'), preset.tokensCss, 'utf8')

  // getBaseURL() 이 VITE_API_BASE_URL 을 최우선으로 본다. Vite 는 .env 뒤에 .env.local 을
  // 로드하므로 템플릿의 tracked .env 와 무관하게 이 값이 이긴다. *.local 은 gitignore 대상.
  await writeFile(join(dir, '.env.local'), `VITE_API_BASE_URL=${env.appApi}\n`, 'utf8')

  await mkdir(join(dir, '.claude'), { recursive: true })
  await writeFile(join(dir, '.claude/settings.json'), `${JSON.stringify(CLAUDE_SETTINGS, null, 2)}\n`, 'utf8')

  // 앱 메타. 여기 박힌 env 가 이후 모든 명령의 대상 환경이다 (전역 기본값 없음).
  writeMeta(dir, { name, mode, proxyOrigin: resolvedProxyOrigin, env: env.name })

  initGit(dir, mode)

  return { dir, mode, env, copied }
}

/**
 * remote 없는 로컬 전용 repo.
 *
 * `git clone` 을 쓰지 않는 이유: 템플릿 레포에 실제 remote 가 있어서 clone 하면 origin 이
 * 공용 템플릿을 가리킨다. 실수로 push 하면 앱 코드가 템플릿 레포로 올라가고, 제품이 스냅샷
 * 부재 시 그 레포로 git 폴백하므로 오염 반경이 넓다.
 *
 * user.name/email 은 repo 로컬로만 설정한다 (없으면 commit 이 거부된다). 사용자 전역 설정은
 * 건드리지 않는다.
 */
function initGit(dir: string, mode: string): void {
  const git = (...args: string[]): void => {
    execFileSync('git', ['-C', dir, ...args], { stdio: 'ignore' })
  }
  git('init', '-q')
  git('config', 'user.name', 'AOS AppGen')
  git('config', 'user.email', 'appgen@local')
  git('add', '-A')
  git('commit', '-q', '-m', `bootstrap: ${mode} preset`)
}
