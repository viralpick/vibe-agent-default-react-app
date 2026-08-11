/**
 * 토큰 저장소.
 *
 * 원칙: **Claude Code 는 비밀을 이름으로만 참조하고 값으로는 만지지 않는다.**
 * 챗에 붙여넣으면 트랜스크립트(로컬 JSONL)에 평문으로 남고 이후 턴마다 컨텍스트로 재전송된다.
 * 명령줄 인자도 마찬가지다. 그래서 `login` 은 클립보드에서 직접 읽고, 나머지 명령은
 * 저장소에서 읽어 쓴다 — 토큰 값이 어떤 명령 문자열에도 나타나지 않는다.
 *
 * 저장은 0600 파일을 쓴다. macOS 키체인(`security add-generic-password`)은 토큰을 argv 로
 * 받아 `ps` 에 잠깐 노출되므로 오히려 불리하다. 작업 디렉토리의 .claude/settings.json 이
 * `Read(~/.aos-appgen/**)` 를 deny 하므로 에이전트는 이 파일을 읽지 못한다.
 *
 * 로그인 방식은 브라우저에서 access token 을 복사하는 것이다. ROPC(비밀번호 grant)를 쓰지
 * 않는 이유: dev access token 이 10시간(실측)이라 자동화 이득이 작고, 비밀번호가 도구를
 * 지나게 되며, 같은 방식을 쓰는 aos CLI 를 별건으로 문제 제기한 상태다.
 */

import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'

/** 도구 상태 디렉토리. 프로젝트 루트 밖에 둔다 — 루트에 있으면 push tar 에 실려 제품으로 넘어간다. */
export const STATE_DIR = join(homedir(), '.aos-appgen')
const TOKEN_PATH = join(STATE_DIR, 'token')

export interface TokenStatus {
  /** 만료까지 남은 초. 이미 만료면 음수. */
  remainingSeconds: number
  expiresAt: Date
  issuedAt: Date | null
  subject: string | null
  email: string | null
}

/** JWT 형태인지 검사한다 (서명 검증은 하지 않는다 — 서버가 한다). */
function assertJwtShape(value: string): void {
  const parts = value.split('.')
  if (parts.length !== 3 || !parts.every(Boolean)) {
    throw new Error(`JWT 형태가 아닙니다 (점으로 구분된 3개 세그먼트가 필요). 길이=${value.length}`)
  }
  if (!value.startsWith('eyJ')) {
    throw new Error('JWT 형태가 아닙니다 (base64url 로 인코딩된 헤더로 시작하지 않음).')
  }
}

function decodePayload(token: string): Record<string, unknown> {
  const [, payload] = token.split('.')
  const json = Buffer.from(payload, 'base64url').toString('utf8')
  return JSON.parse(json) as Record<string, unknown>
}

function readClipboard(): string {
  const candidates: [string, string[]][] =
    platform() === 'darwin'
      ? [['pbpaste', []]]
      : [
          ['wl-paste', ['--no-newline']],
          ['xclip', ['-selection', 'clipboard', '-o']],
          ['xsel', ['--clipboard', '--output']],
        ]

  for (const [cmd, args] of candidates) {
    try {
      return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 20 })
    } catch {
      // 다음 후보로 넘어간다.
    }
  }
  throw new Error(`클립보드를 읽을 수 없습니다. 시도한 명령: ${candidates.map(([c]) => c).join(', ')}`)
}

/**
 * 클립보드에서 토큰을 읽어 저장한다.
 *
 * 클립보드에 토큰이 아닌 것이 들어 있을 수 있으므로 반드시 형태를 검증한다 — 검증 없이
 * 저장하면 이후 모든 호출이 401 로 실패하고 원인이 드러나지 않는다.
 */
export function saveTokenFromClipboard({ clear = false }: { clear?: boolean } = {}): TokenStatus {
  const raw = readClipboard().trim()
  assertJwtShape(raw)
  const status = statusOf(raw)
  if (status.remainingSeconds <= 0) {
    throw new Error(`이미 만료된 토큰입니다 (만료 ${status.expiresAt.toISOString()}). 새로 복사하세요.`)
  }

  mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 })
  writeFileSync(TOKEN_PATH, raw, { encoding: 'utf8', mode: 0o600 })
  chmodSync(TOKEN_PATH, 0o600)

  if (clear) {
    try {
      if (platform() === 'darwin') execFileSync('pbcopy', [], { input: '' })
    } catch {
      // 클립보드 비우기 실패는 치명적이지 않다.
    }
  }
  return status
}

/** 저장된 토큰을 반환한다. 없거나 만료면 throw. */
export function readToken(): string {
  if (!existsSync(TOKEN_PATH)) {
    throw new Error('저장된 토큰이 없습니다. 브라우저에서 access token 을 복사한 뒤 `appgen login` 을 실행하세요.')
  }
  const token = readFileSync(TOKEN_PATH, 'utf8').trim()
  assertJwtShape(token)
  const status = statusOf(token)
  if (status.remainingSeconds <= 0) {
    throw new Error(`토큰이 만료됐습니다 (${status.expiresAt.toISOString()}). 새로 복사한 뒤 \`appgen login\` 을 실행하세요.`)
  }
  return token
}

export function statusOf(token: string): TokenStatus {
  const payload = decodePayload(token)
  const exp = typeof payload.exp === 'number' ? payload.exp : null
  if (exp === null) throw new Error('토큰에 exp 클레임이 없습니다.')
  const iat = typeof payload.iat === 'number' ? payload.iat : null
  return {
    remainingSeconds: Math.round(exp - Date.now() / 1000),
    expiresAt: new Date(exp * 1000),
    issuedAt: iat === null ? null : new Date(iat * 1000),
    subject: typeof payload.sub === 'string' ? payload.sub : null,
    email: typeof payload.email === 'string' ? payload.email : null,
  }
}

/** 저장된 토큰의 상태. 토큰을 반환하지 않는다. */
export function tokenStatus(): TokenStatus {
  return statusOf(readToken())
}

export function formatRemaining(seconds: number): string {
  if (seconds <= 0) return '만료됨'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}시간 ${m}분 남음` : `${m}분 남음`
}
