/**
 * 스냅샷 push / pull — 로컬 git 이력과 제품 스냅샷 체인을 잇는다.
 *
 * 두 이력은 별개다. git 은 로컬 전용이고 수백 회 반복의 세부를 담으며 제품에 넘어가지
 * 않는다 (tar 가 `.git` 을 제외한다). 스냅샷 체인은 **승격된 버전만** 담고 제품과 공유한다.
 * push 가 그 승격 지점이다.
 *
 * ## 포맷 규칙을 클라이언트에 복제하지 않는다
 *
 * HISTORY 엔트리의 번호·날짜·인용·새니타이즈는 서버(`app_builder_history`)가 소유한다.
 * 여기서는 서버가 조립해 돌려준 `history_entry` 를 EOF 에 붙이기만 한다. 붙이는 규칙은
 * 드리프트할 여지가 없어 클라이언트에 둬도 된다.
 *
 * tar 계약(아카이브 루트, 제외 경로, 경로 탈출)도 서버가 검증한다. 클라이언트는 제품과 같은
 * exclude 패턴으로 만들고, 어긋나면 서버의 400 메시지가 정확히 알려준다.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { appEnv, readMeta, writeMeta, type AppMeta, type Environment } from './env.ts'
import { agentBytes, agentUpload } from './http.ts'
import { STATE_DIR, tokenStatus } from './token.ts'

/**
 * tar 에서 제외하는 것.
 *
 * 앞의 셋은 제품 `save_snapshot_agent` 와 동일하다. `.git` 은 e2b FUSE 가 utime/chmod 복원을
 * EPERM 으로 막아 tar 를 죽이고, `dev.log` 는 실행 중인 dev 서버가 계속 쓰는 파일이라
 * "file changed as we read it" 로 스냅샷이 통째로 유실된다.
 *
 * 뒤의 둘은 로컬 전용 산물이라 우리가 추가한다. `.env.local` 이 특히 중요하다 — 거기 박힌
 * `VITE_API_BASE_URL` 이 제품 샌드박스 빌드까지 따라가면 배포된 앱이 우리 로컬/dev 를 가리킨다.
 * 제품 스냅샷에는 원래 이 파일이 없으므로 제외하는 것이 제품과 같아지는 방향이다.
 */
const TAR_EXCLUDES = ['node_modules', './.git', './dev.log', './.env.local', './.claude'] as const

/**
 * pull 이 워킹트리를 비울 때 남기는 것.
 *
 * tar 에서 제외한 것과 짝이 맞아야 한다 — 제외했는데 안 남기면 pull 이 로컬 설정을 지운다.
 * `.git` 은 이력 자체이고, `node_modules` 는 재설치가 느리다.
 */
const PULL_PRESERVE = new Set(['.git', 'node_modules', '.env.local', '.claude'])

export interface RequirementItem {
  name: string
  description: string
}

interface PushResponse {
  version: number
  s3_key: string
  chat_context_id: number
  history_entry_number: number
  history_entry: string
  view_name: string
  requirements_count: number
  warnings: string[]
}

// ── 상태 (프로젝트 루트 밖) ────────────────────────────────────────────────
//
// `base_version` 을 `.cos/` 안에 두면 tar 에 실려 제품으로 가고, pull 이 낡은 값을 되돌려놓는다.

function baseVersionPath(chatId: string): string {
  return join(STATE_DIR, 'chats', chatId, 'base_version')
}

export function readBaseVersion(chatId: string): number {
  const path = baseVersionPath(chatId)
  if (!existsSync(path)) return 0 // 신규 챗의 첫 push 는 0 이다.
  const raw = readFileSync(path, 'utf8').trim()
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`base_version 파일이 손상됐습니다 (${path}): ${raw.slice(0, 40)}`)
  }
  return parsed
}

function writeBaseVersion(chatId: string, version: number): void {
  const path = baseVersionPath(chatId)
  mkdirSync(join(STATE_DIR, 'chats', chatId), { recursive: true, mode: 0o700 })
  writeFileSync(path, `${version}\n`, 'utf8')
}

// ── git (선커밋 / 후커밋) ──────────────────────────────────────────────────

function git(dir: string, args: string[]): string {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' })
}

function assertGitRepo(dir: string): void {
  try {
    git(dir, ['rev-parse', '--git-dir'])
  } catch {
    throw new Error(
      `git 저장소가 아닙니다: ${dir}\n` +
        'pull 은 덮어쓰기 전 상태를 커밋으로 보존하는 것에 의존하므로 git 없이는 실행하지 않습니다.',
    )
  }
}

function isDirty(dir: string): boolean {
  return git(dir, ['status', '--porcelain']).trim().length > 0
}

/** 변경이 있으면 커밋하고 true. 없으면 아무것도 하지 않고 false. */
function commitAll(dir: string, message: string): boolean {
  if (!isDirty(dir)) return false
  git(dir, ['add', '-A'])
  git(dir, ['commit', '-q', '-m', message])
  return true
}

// ── tar ───────────────────────────────────────────────────────────────────

function withTempDir<T>(run: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'appgen-'))
  try {
    return run(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * 중첩 `.git` 을 찾는다. 있으면 push 에서 빠진다는 사실을 알려야 한다.
 *
 * 배경: `--exclude=./.git` 의 앵커링이 tar 구현마다 다르다. 제품의 GNU tar 는 루트만
 * 제외하지만 macOS bsdtar 3.5.3 은 **어느 깊이든** 제외한다 (실측). 그래서 로컬에서 만든
 * tar 는 제품보다 엄격하고, 중첩 `.git` 이 있으면 push 에서 빠진 뒤 pull 이 워킹트리를
 * 다시 깔 때 로컬에서도 사라진다. 조용한 유실이라 경고로 드러낸다.
 *
 * tar 동작을 맞추려 들지 않는 이유: `--anchored` 가 bsdtar 에 없어 이식성 있는 표현이 없고,
 * 이 템플릿에서 중첩 git 저장소는 실질적으로 생기지 않는다. 드러내는 쪽이 값싸다.
 */
function findNestedGitDirs(appDir: string, prefix = '', depth = 0): string[] {
  if (depth > 4) return [] // 깊은 트리를 다 훑을 이유가 없다 — 실무 사례는 얕다.
  const found: string[] = []
  for (const entry of readdirSync(join(appDir, prefix), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.name === 'node_modules') continue
    if (entry.name === '.git') {
      if (rel !== '.git') found.push(rel) // 루트 .git 은 의도된 제외다.
      continue
    }
    found.push(...findNestedGitDirs(appDir, rel, depth + 1))
  }
  return found
}

function createTar(appDir: string): Uint8Array {
  return withTempDir((tmp) => {
    const out = join(tmp, 'code.tar.gz')
    // 아카이브 루트가 프로젝트 루트여야 한다 (cwd = appDir, 대상 = `.`).
    execFileSync('tar', [...TAR_EXCLUDES.map((p) => `--exclude=${p}`), '-czf', out, '.'], {
      cwd: appDir,
    })
    return new Uint8Array(readFileSync(out))
  })
}

/**
 * 워킹트리를 비우고 tar 를 전개한다.
 *
 * merge 를 쓰지 않는다 — 선커밋으로 기준선을 잡고 덮어쓴 뒤 다시 커밋하므로 선형 이력이고
 * 충돌이 원천적으로 없다. 갈라짐 자체는 push 의 `base_version` 409 가 잡는다.
 *
 * 비우고 전개하는 이유: 덮어쓰기만 하면 스냅샷에 없는 로컬 파일이 남아 워킹트리가 스냅샷과
 * 달라진다. 그러면 다음 push 의 tar 에 그 파일이 섞여 들어간다.
 */
function extractOver(appDir: string, tarBytes: Uint8Array): void {
  for (const entry of readdirSync(appDir)) {
    if (PULL_PRESERVE.has(entry)) continue
    rmSync(join(appDir, entry), { recursive: true, force: true })
  }
  withTempDir((tmp) => {
    const src = join(tmp, 'code.tar.gz')
    writeFileSync(src, tarBytes)
    execFileSync('tar', ['-xzf', src, '-C', appDir])
  })
}

// ── HISTORY (서버가 조립한 엔트리를 붙이기만 한다) ──────────────────────────

const HISTORY_REL = '.cos/HISTORY.md'

function appendHistoryEntry(appDir: string, entry: string): void {
  const path = join(appDir, HISTORY_REL)
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : ''
  const base = existing.replace(/\s+$/, '')
  writeFileSync(path, base ? `${base}\n\n${entry}\n` : `${entry}\n`, 'utf8')
}

// ── push / pull ───────────────────────────────────────────────────────────

function resolveChatId(meta: AppMeta, override: string | undefined): string {
  const chatId = override ?? meta.chatId
  if (!chatId) {
    throw new Error(
      '연결된 chat 이 없습니다. 제품 UI 에서 빈 앱빌더 챗을 만든 뒤 --chat <id> 로 한 번 알려주세요.\n' +
        '  (chat 을 만든 사람만 그 챗을 열 수 있습니다. 고객에게 넘길 앱이면 고객이 챗을 만들어야 합니다.)',
    )
  }
  if (!/^\d+$/.test(chatId)) throw new Error(`chat id 가 숫자가 아닙니다: ${chatId}`)
  return chatId
}

function resolveTenantId(meta: AppMeta, override: string | undefined): string {
  const tenantId = override ?? meta.tenantId
  if (!tenantId) throw new Error('테넌트를 모릅니다. --tenant <회사 id> 로 한 번 알려주세요.')
  if (!/^\d+$/.test(tenantId)) throw new Error(`tenant id 가 숫자가 아닙니다: ${tenantId}`)
  return tenantId
}

/** 이번 호출에서 새로 알게 된 chat/tenant 를 앱 메타에 남긴다 (다음부터 생략 가능). */
function rememberBinding(appDir: string, meta: AppMeta, chatId: string, tenantId: string): void {
  if (meta.chatId === chatId && meta.tenantId === tenantId) return
  writeMeta(appDir, { ...meta, chatId, tenantId })
}

export interface PushOptions {
  appDir: string
  prompt: string
  tenantId?: string
  chatId?: string
  title?: string
  requirements?: RequirementItem[]
}

export interface PushResult extends PushResponse {
  chatId: string
  env: Environment
  preCommitted: boolean
  /** 서버가 아니라 클라이언트가 발견한 경고 (tar 에서 빠지는 것 등). */
  localWarnings: string[]
}

export async function pushSnapshot(options: PushOptions): Promise<PushResult> {
  const { appDir, prompt } = options
  assertGitRepo(appDir)
  const meta = readMeta(appDir)
  const env = appEnv(appDir)
  const chatId = resolveChatId(meta, options.chatId)
  const tenantId = resolveTenantId(meta, options.tenantId)
  // 토큰을 먼저 확인한다 — 뒤에서 확인하면 선커밋과 tar 압축을 다 하고 나서 401 로 죽는다.
  tokenStatus(env.name)

  // 선커밋 — 업로드하는 tar 와 git HEAD 를 일치시킨다. 자동커밋 훅은 Edit/Write 만 잡으므로
  // 손으로 만든 변경이나 npm 산물이 남아 있을 수 있다.
  const preCommitted = commitAll(appDir, 'pre-push: uncommitted changes')

  const nested = findNestedGitDirs(appDir)
  const localWarnings = nested.map(
    (rel) => `${rel} 은 스냅샷에 포함되지 않습니다 (tar 가 .git 을 제외). pull 하면 로컬에서도 사라집니다.`,
  )

  const response = await agentUpload<PushResponse>(
    `/internal/app-builder/chats/${chatId}/snapshots`,
    {
      env,
      tenantId,
      file: { name: 'code.tar.gz', bytes: createTar(appDir), contentType: 'application/gzip' },
      fields: {
        prompt,
        base_version: String(readBaseVersion(chatId)),
        title: options.title,
        requirements: options.requirements ? JSON.stringify(options.requirements) : undefined,
        design_mode: meta.mode,
      },
    },
  )

  // 서버가 tar 안 HISTORY.md 를 갱신했으므로 로컬 사본도 맞춘다. 안 맞추면 다음 push 의
  // tar 에 이번 엔트리가 없어 서버가 같은 번호를 다시 부여한다.
  appendHistoryEntry(appDir, response.history_entry)
  writeBaseVersion(chatId, response.version)
  rememberBinding(appDir, meta, chatId, tenantId)
  commitAll(appDir, `push: v${response.version} (${response.view_name})`)

  return { ...response, chatId, env, preCommitted, localWarnings }
}

export interface PullOptions {
  appDir: string
  tenantId?: string
  chatId?: string
  version?: number
}

export interface PullResult {
  chatId: string
  env: Environment
  version: number
  publishStatus: string
  preCommitted: boolean
  /**
   * 전개 결과가 직전 상태와 달라 커밋이 생겼는지.
   *
   * false 는 **되받은 트리가 로컬과 바이트 단위로 같다**는 뜻이다 (push 직후 pull 하면 정상적으로
   * false). 커밋 여부를 결과에 담지 않으면 출력이 "커밋했다"고 거짓을 말한다.
   */
  committed: boolean
  bytes: number
}

export async function pullSnapshot(options: PullOptions): Promise<PullResult> {
  const { appDir } = options
  assertGitRepo(appDir)
  const meta = readMeta(appDir)
  const env = appEnv(appDir)
  const chatId = resolveChatId(meta, options.chatId)
  const tenantId = resolveTenantId(meta, options.tenantId)
  tokenStatus(env.name)

  // 선커밋이 pull 의 안전망이다 — 덮어쓴 뒤 되돌리려면 이 커밋으로 restore 한다.
  const preCommitted = commitAll(appDir, 'pre-pull: uncommitted changes')

  const { bytes, headers } = await agentBytes(
    `/internal/app-builder/chats/${chatId}/snapshots`,
    { env, tenantId, query: { version: options.version?.toString() } },
  )

  extractOver(appDir, bytes)

  // 앱 메타는 전개 **후에 로컬 값으로 다시 쓴다.** 전개가 워킹트리를 비우므로 스냅샷 안의
  // `.cos/appgen.json` 이 로컬 것을 대체하는데, 그 파일에는 두 가지 문제가 있다.
  // ① 제품에서 만들어진 앱의 스냅샷에는 아예 없어서 로컬 메타가 사라진다
  // ② 있더라도 그 앱을 처음 bootstrap 한 사람의 환경(env)이 박혀 있어 내 환경과 다를 수 있다
  // 어느 쪽이든 다음 명령이 엉뚱한 환경을 때리거나 실패한다.
  writeMeta(appDir, { ...meta, chatId, tenantId })

  // 헤더의 version 이 다음 push 의 base_version 이다. 0 은 레거시 키 폴백(스냅샷 row 없이
  // 객체만 존재)이며, 그 값으로 push 하면 v1 이 만들어진다 — 서버와 같은 규약이다.
  const version = Number.parseInt(headers.get('X-Snapshot-Version') ?? '0', 10)
  writeBaseVersion(chatId, Number.isInteger(version) ? version : 0)

  const committed = commitAll(appDir, `pull: product v${version}`)

  return {
    chatId,
    env,
    version,
    publishStatus: headers.get('X-Snapshot-Publish-Status') ?? '',
    preCommitted,
    committed,
    bytes: bytes.length,
  }
}
