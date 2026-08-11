/**
 * 앱 작업 디렉토리를 만든다.
 *
 * 작업 디렉토리는 **이 레포 체크아웃이 아니다.** 여기서 직접 앱을 만들면 템플릿이 오염되고,
 * 제품의 restore_code_agent 가 스냅샷 없는 신규 앱 샌드박스를 이 레포 main 으로
 * `git reset --hard` 하므로 오염이 전 신규 앱에 번진다. 그래서 사본을 따로 만든다.
 *
 * 구조는 샌드박스의 /app/view-gen 과 동일해야 한다. push 가 만드는 tar 의 아카이브 루트가
 * 프로젝트 루트이고, 제품이 그 tar 를 그대로 풀기 때문이다.
 */

import { execFileSync } from 'node:child_process'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { resolvePreset } from './presets.mjs'

const TOOL_DIR = dirname(fileURLToPath(import.meta.url))
const TEMPLATE_ROOT = resolve(TOOL_DIR, '../..')

/** 이 도구 자신은 작업 디렉토리로 복사하지 않는다 (복사되면 push tar 에 실려 제품으로 넘어간다). */
const EXCLUDED_PREFIXES = ['tools/']

/**
 * dev 고정. 환경 오버라이드를 의도적으로 제공하지 않는다.
 *
 * aos CLI 의 사고 지점이 `production` 기본 프리셋이었다. prod 로 확장할 때는 이 도구를
 * 확장하지 않고 별도 진입점으로 분리한다 — 한 도구에 두 환경을 넣으면 기본값 문제가 생긴다.
 */
export const DEV = Object.freeze({
  appApi: 'https://app-api-v2-dev.commerceos.ai',
  agentApi: 'https://agent-api-dev.commerceos.ai',
  /** 생성된 앱이 호출할 /fe-bff 프록시 절대 origin. design_md 에 박힌다. */
  proxyOrigin: 'https://os-dev.enhans.ai',
})

/**
 * 템플릿의 tracked 파일 목록을 반환한다.
 *
 * `git ls-files` 를 쓰는 이유: 로컬 untracked 산물(agenthub-appbuilder/, .taskmaster/,
 * trace_reports/ 등)을 자동으로 배제하고, 제품 샌드박스가 받는 main 내용과 정확히 일치하는
 * 집합을 얻는다. 수동 exclude 목록은 템플릿이 변하면 낡는다.
 */
function templateFiles() {
  const out = execFileSync('git', ['-C', TEMPLATE_ROOT, 'ls-files', '-z'], { encoding: 'utf8' })
  return out
    .split('\0')
    .filter(Boolean)
    .filter((p) => !EXCLUDED_PREFIXES.some((prefix) => p.startsWith(prefix)))
}

async function copyTemplate(targetDir) {
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

/**
 * @param {object} opts
 * @param {string} opts.name        앱 이름 (작업 디렉토리 이름)
 * @param {string} [opts.mode]      디자인 모드. 기본 synapse
 * @param {string} [opts.targetDir] 작업 디렉토리 경로. 기본 ~/apps/<name>
 * @param {string} [opts.proxyOrigin]
 * @param {string} [opts.designResourcesDir]
 */
export async function bootstrap({ name, mode = 'synapse', targetDir, proxyOrigin = DEV.proxyOrigin, designResourcesDir }) {
  if (!name || !/^[a-z0-9][a-z0-9._-]*$/i.test(name)) {
    throw new Error(`앱 이름이 올바르지 않습니다: ${name} (영숫자로 시작, 영숫자/.-_ 만)`)
  }
  const dir = targetDir ? resolve(targetDir) : join(process.env.HOME, 'apps', name)
  if (existsSync(dir)) throw new Error(`이미 존재합니다: ${dir}`)

  // 프리셋을 먼저 해석한다 — 실패하면 디렉토리를 만들기 전에 멈춘다.
  const preset = await resolvePreset({ mode, proxyOrigin, ...(designResourcesDir ? { designResourcesDir } : {}) })

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

  // Claude Code 가 규약을 따르도록 GUIDE 를 CLAUDE.md 로도 배치한다.
  await writeFile(join(dir, 'CLAUDE.md'), guide, 'utf8')

  // 디자인 모드 원문. 제품도 FE 가 보낸 tokens_css 로 이 파일을 교체한다.
  await writeFile(join(dir, 'src/theme.css'), preset.tokensCss, 'utf8')

  // getBaseURL() 이 VITE_API_BASE_URL 을 최우선으로 본다. Vite 는 .env 뒤에 .env.local 을
  // 로드하므로 템플릿의 tracked .env 와 무관하게 이 값이 이긴다. *.local 은 gitignore 대상.
  await writeFile(join(dir, '.env.local'), `VITE_API_BASE_URL=${DEV.appApi}\n`, 'utf8')

  await mkdir(join(dir, '.claude'), { recursive: true })
  await writeFile(join(dir, '.claude/settings.json'), JSON.stringify(CLAUDE_SETTINGS, null, 2) + '\n', 'utf8')

  await writeFile(join(dir, '.cos/appgen.json'), JSON.stringify({ name, mode, proxyOrigin, env: 'dev' }, null, 2) + '\n', 'utf8')

  initGit(dir, mode)

  return { dir, mode, copied }
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
function initGit(dir, mode) {
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { stdio: 'ignore' })
  git('init', '-q')
  git('config', 'user.name', 'AOS AppGen')
  git('config', 'user.email', 'appgen@local')
  git('add', '-A')
  git('commit', '-q', '-m', `bootstrap: ${mode} preset`)
}
