/**
 * FE 레포의 디자인 프리셋 원문을 읽어온다.
 *
 * 프리셋 원문(DESIGN_MD / TOKENS_CSS)은 FE 가 단일 소유한다. 앱빌더 제품은 generate_app
 * 시점에 이 값을 소켓으로 BE 에 보내고, BE 는 sandbox 의 .cos/DESIGN.md 와 src/theme.css 에
 * 그대로 write 한다. 로컬 경로도 같은 원문을 써야 제품 챗에서 수정할 때 덮어써지지 않는다.
 *
 * 원문이 `.ts` 파일의 템플릿 리터럴이라 정규식으로 뜯으면 이스케이프(\` / \${) 처리가
 * 깨지기 쉽다. 대신 esbuild 로 트랜스파일해 모듈을 그대로 import 한다 — FE 가 값을 바꿔도
 * 파서를 고칠 일이 없다.
 *
 * design_md 는 순수 복사가 아니다. FE 의 resolveDesignSpec 이
 *   design_md = preset.DESIGN_MD + buildExternalIntegrationsMd(proxyOrigin)
 * 으로 조립한다. proxyOrigin 은 생성된 앱이 호출할 /fe-bff 프록시의 절대 origin 이며
 * FE 는 emit 시점의 window.location.origin 을 쓴다. 로컬에서는 알 수 없으므로 caller 가 준다.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** FE 레포의 design-resources 디렉토리 (기본값은 형제 디렉토리 체크아웃 가정). */
export const DEFAULT_FE_DESIGN_RESOURCES =
  '../commerceos-application/src/features/ai/app-builder/model/design-resources'

/**
 * 단일 `.ts` 모듈을 트랜스파일해 import 한다.
 *
 * 대상 모듈들(design-md.ts / tokens-css.ts / external-integrations.ts)은 상수와 순수 함수만
 * export 하고 외부 import 가 없다. 그래서 파일 하나만 번들 없이 변환하면 충분하다.
 */
async function importTsModule(tsPath) {
  const { transform } = await loadEsbuild()
  const source = await readUtf8(tsPath)
  const { code } = await transform(source, { loader: 'ts', format: 'esm' })

  // data: URL 로 import 하면 임시 파일이 필요 없지만, 향후 상대 import 가 생기면
  // 해석이 불가능해진다. 디스크에 쓰고 파일 URL 로 import 해 확장 여지를 남긴다.
  const dir = await mkdtemp(join(tmpdir(), 'appgen-preset-'))
  try {
    const out = join(dir, 'mod.mjs')
    await writeFile(out, code, 'utf8')
    return await import(pathToFileURL(out).href)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function loadEsbuild() {
  try {
    return await import('esbuild')
  } catch {
    throw new Error(
      'esbuild 를 찾을 수 없습니다. vibe 레포 루트에서 `npm install` 을 먼저 실행하세요 ' +
        '(@tailwindcss/vite 가 esbuild 를 함께 설치합니다).'
    )
  }
}

async function readUtf8(path) {
  const { readFile } = await import('node:fs/promises')
  try {
    return await readFile(path, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`파일을 찾을 수 없습니다: ${path}`)
    }
    throw err
  }
}

/**
 * 프리셋 원문을 반환한다.
 *
 * @param {object} opts
 * @param {string} opts.mode          디자인 모드 (synapse / free / apple / notion ...)
 * @param {string} opts.proxyOrigin   /fe-bff 프록시 절대 origin. design_md 에 박힌다
 * @param {string} [opts.designResourcesDir] FE design-resources 경로
 * @returns {Promise<{mode: string, designMd: string, tokensCss: string}>}
 */
export async function resolvePreset({ mode, proxyOrigin, designResourcesDir = DEFAULT_FE_DESIGN_RESOURCES }) {
  if (!mode) throw new Error('mode 는 필수입니다.')
  if (!proxyOrigin) {
    throw new Error(
      'proxyOrigin 은 필수입니다. 생성된 앱이 호출할 /fe-bff 프록시의 절대 origin 이며 ' +
        '환경마다 다릅니다 (예: https://app.commerceos.ai).'
    )
  }
  assertAbsoluteOrigin(proxyOrigin)

  const presetDir = join(designResourcesDir, mode)
  const [designModule, tokensModule, externalModule] = await Promise.all([
    importTsModule(join(presetDir, 'design-md.ts')),
    importTsModule(join(presetDir, 'tokens-css.ts')),
    importTsModule(join(designResourcesDir, 'external-integrations.ts')),
  ])

  const designMd = designModule.DESIGN_MD
  const tokensCss = tokensModule.TOKENS_CSS
  const buildExternal = externalModule.buildExternalIntegrationsMd

  if (typeof designMd !== 'string') throw new Error(`${mode}/design-md.ts 가 DESIGN_MD 문자열을 export 하지 않습니다.`)
  if (typeof tokensCss !== 'string') throw new Error(`${mode}/tokens-css.ts 가 TOKENS_CSS 문자열을 export 하지 않습니다.`)
  if (typeof buildExternal !== 'function') {
    throw new Error('external-integrations.ts 가 buildExternalIntegrationsMd 함수를 export 하지 않습니다.')
  }

  return {
    mode,
    // FE resolveDesignSpec 과 동일한 조립 순서를 유지한다.
    designMd: designMd + buildExternal(proxyOrigin),
    tokensCss,
  }
}

function assertAbsoluteOrigin(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`proxyOrigin 이 절대 URL 이 아닙니다: ${value}`)
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`proxyOrigin 은 origin 만 담아야 합니다 (경로/쿼리 없이): ${value}`)
  }
}
