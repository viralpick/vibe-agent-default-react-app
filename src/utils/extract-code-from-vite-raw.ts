/**
 * 이스케이프된 문자열을 원래 문자로 복원
 */
function unescapeString(str: string): string {
  return str
    .replace(/\\n/g, '\n') // 이스케이프된 줄바꿈을 실제 줄바꿈으로
    .replace(/\\t/g, '\t') // 탭
    .replace(/\\r/g, '\r') // 캐리지 리턴
    .replace(/\\'/g, "'") // 싱글 쿼트
    .replace(/\\"/g, '"') // 더블 쿼트
    .replace(/\\\\/g, '\\') // 백슬래시 (마지막에 처리)
}

/**
 * Vite의 ?raw 응답에서 실제 코드만 추출
 * Vite는 raw import를 다음 형태로 래핑하고 소스맵을 추가함:
 * - export default `...` (템플릿 리터럴)
 * - export default '...' (싱글 쿼트, \n 이스케이프)
 */
export function extractCodeFromViteRaw(content: string): string {
  // 소스맵 제거 (//# sourceMappingURL= 이후 모든 내용)
  const sourceMapIndex = content.indexOf('//# sourceMappingURL=')
  const withoutSourceMap =
    sourceMapIndex !== -1
      ? content.substring(0, sourceMapIndex).trim()
      : content

  // 1. 템플릿 리터럴 형식: export default `...`
  const backtickMatch = withoutSourceMap.match(
    /^export default `([\s\S]*)`\s*;?\s*$/
  )
  if (backtickMatch?.[1]) {
    return backtickMatch[1]
      .replace(/\\`/g, '`')
      .replace(/\\\$/g, '$')
      .replace(/\\\\/g, '\\')
  }

  // 2. 싱글 쿼트 형식: export default '...'
  const singleQuoteMatch = withoutSourceMap.match(
    /^export default '([\s\S]*)'\s*;?\s*$/
  )
  if (singleQuoteMatch?.[1]) {
    return unescapeString(singleQuoteMatch[1])
  }

  // 3. 더블 쿼트 형식: export default "..."
  const doubleQuoteMatch = withoutSourceMap.match(
    /^export default "([\s\S]*)"\s*;?\s*$/
  )
  if (doubleQuoteMatch?.[1]) {
    return unescapeString(doubleQuoteMatch[1])
  }

  return withoutSourceMap
}