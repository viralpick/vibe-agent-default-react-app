/**
 * 환경 정의와 앱 메타(`.cos/appgen.json`) 읽기·쓰기.
 *
 * **전역 기본 환경을 만들지 않는다.** 환경은 `appgen bootstrap` 시점에 앱 디렉토리에
 * 박히고, 이후 모든 명령이 그 앱의 메타에서 읽는다. `aos` CLI 의 사고 지점이 `production`
 * 기본 프리셋이었다 — 전역 기본값은 언젠가 누군가 잘못된 환경을 때린다. 앱마다 환경이
 * 고정되어 있으면 잘못 맞출 기본값 자체가 없다.
 *
 * 앱 디렉토리 밖에서 도는 명령(`probe`, `login`)만 `--env` 로 환경을 명시하며 기본은 dev 다.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type EnvName = 'dev' | 'local'

export interface Environment {
  name: EnvName
  /** 온톨로지 조회·펑션 생성 (app-api). */
  appApi: string
  /** 스냅샷 push/pull (agent-app). */
  agentApi: string
  /** 생성된 앱이 호출할 `/fe-bff` 프록시 절대 origin. designMd 에 박힌다. */
  proxyOrigin: string
}

export const ENVIRONMENTS: Record<EnvName, Environment> = {
  dev: {
    name: 'dev',
    appApi: 'https://app-api-v2-dev.commerceos.ai',
    agentApi: 'https://agent-api-dev.commerceos.ai',
    proxyOrigin: 'https://os-dev.enhans.ai',
  },
  local: {
    // 풀 로컬 스택. 로컬 서버를 dev DB 에 붙이지 않고 검증하기 위한 환경이다.
    //
    // app-api 는 Spring Boot 기본 8080, agent-app 은 8000 이다. 주의: app-api 에
    // `AUTHZ_PASSPORT_ENABLED=true` 가 없으면 `/authz/me` 가 401 을 내고, push/pull 의
    // 신원 확정이 그 응답에 의존하므로 전부 401 로 보인다 (기본값이 false).
    name: 'local',
    appApi: 'http://localhost:8080',
    agentApi: 'http://localhost:8000',
    // 로컬 FE(commerceos-application) origin. 외부 API 프록시를 쓰는 앱에만 의미가 있고
    // 포트가 셋업마다 다르므로 `bootstrap --proxy-origin` 으로 덮어쓸 수 있게 둔다.
    proxyOrigin: 'http://localhost:3000',
  },
}

/** dev 환경. 앱 메타가 없는 명령의 기본값이다. */
export const DEV = ENVIRONMENTS.dev

export function resolveEnv(name: string | undefined): Environment {
  if (name === undefined) return DEV
  const env = ENVIRONMENTS[name as EnvName]
  if (!env) {
    throw new Error(`알 수 없는 환경: ${name}\n사용 가능: ${Object.keys(ENVIRONMENTS).join(', ')}`)
  }
  return env
}

/**
 * 앱 디렉토리의 `.cos/appgen.json`.
 *
 * 이 파일은 프로젝트 루트 안이라 push tar 에 실려 제품으로 넘어간다. 그래서 **낡을 수 있는
 * 값을 두지 않는다** — `base_version` 은 pull 이 낡은 값을 되돌려놓을 수 있어 밖에 둔다
 * (`snapshot.ts` 의 STATE). `chatId` 는 그 앱의 정체이고 pull 이 같은 값을 되돌려주므로
 * 낡지 않는다.
 */
export interface AppMeta {
  name: string
  mode: string
  proxyOrigin: string
  env: EnvName
  /** 연결된 제품 chat. 첫 push/pull 의 `--chat` 으로 기록되고 이후 생략할 수 있다. */
  chatId?: string
  /** 테넌트(회사) id. 첫 push/pull 의 `--tenant` 으로 기록된다 — 18자리 숫자를 매번 치면 오타가 난다. */
  tenantId?: string
}

const META_PATH = '.cos/appgen.json'

export function metaPath(appDir: string): string {
  return join(appDir, META_PATH)
}

export function readMeta(appDir: string): AppMeta {
  let raw: string
  try {
    raw = readFileSync(metaPath(appDir), 'utf8')
  } catch {
    throw new Error(
      `앱 디렉토리가 아닙니다 (${META_PATH} 없음): ${appDir}\n` +
        '`appgen bootstrap <이름>` 으로 만든 디렉토리에서 실행하세요.',
    )
  }
  const meta = JSON.parse(raw) as AppMeta
  if (!meta.env) throw new Error(`${META_PATH} 에 env 가 없습니다. bootstrap 을 다시 실행하세요.`)
  resolveEnv(meta.env) // 알 수 없는 환경이면 여기서 멈춘다.
  return meta
}

export function writeMeta(appDir: string, meta: AppMeta): void {
  writeFileSync(metaPath(appDir), `${JSON.stringify(meta, null, 2)}\n`, 'utf8')
}

/** 앱 메타에 기록된 환경. */
export function appEnv(appDir: string): Environment {
  return resolveEnv(readMeta(appDir).env)
}
